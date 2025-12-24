import amqp, { Channel, ConsumeMessage } from 'amqplib';
import { MongoClient } from 'mongodb';
import { exec } from 'child_process';
import util from 'util';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const execPromise = util.promisify(exec);

const MONGO_URI = process.env.MONGODB_URL || process.env.MONGO_URI || 'mongodb://localhost:27017';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';

const DB_NAME = 'automation_platform';
const COLLECTION_NAME = 'executions';

async function startWorker() {
    let connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
    let channel: Channel | null = null;
    let mongoClient: MongoClient | null = null;

    try {
        console.log(`👷 Worker connecting to Mongo: ${MONGO_URI}`);
        mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
        console.log('Connected to MongoDB');

        let retries = 5;

        while (retries > 0) {
            try {
                console.log(`👷 Worker connecting to RabbitMQ at ${RABBITMQ_URL}... (${retries} attempts left)`);
                connection = await amqp.connect(RABBITMQ_URL);
                channel = await connection.createChannel();
                await channel.assertQueue('test_queue', { durable: true });
                await channel?.prefetch(1);
                console.log('Worker connected to RabbitMQ and waiting for messages...')
                break;
            } catch (error) {
                console.error('Failed to connect to RabbitMQ', error);
                retries--;
                await new Promise(res => setTimeout(res, 5000));
            }
        }
    } catch (error) {
        console.error('Critical Infrastructure Failure:', error);
        process.exit(1);
    }

    if (!channel || !mongoClient) process.exit(1);

    const db = mongoClient.db(DB_NAME);
    const executionsCollection = db.collection(COLLECTION_NAME);

    console.log('Worker is ready to process messages.');

    channel.consume('test_queue', async (msg: ConsumeMessage | null) => {
        if (msg) {
            const content = msg.content.toString();
            const task = JSON.parse(content);
            const taskId = task.taskId || 'unknown-task';

            console.log('------------------------------------------------');
            console.log(`📥 Processing Task: ${taskId}`);

            await executionsCollection.updateOne(
                { taskId: taskId },
                {
                    $set: {
                        status: 'RUNNING',
                        startTime: new Date(),
                        config: task.config,
                        tests: task.tests
                    }
                },
                { upsert: true }
            );

            try {
                const testPaths = task.tests.join(' ');
                const command = `npx playwright test ${testPaths}`;
                console.log(`Executing command: ${command}`);

                const envVars = {
                    ...process.env,
                    BASE_URL: task.config.baseUrl || process.env.BASE_URL
                };

                const { stdout, stderr } = await execPromise(command, { env: envVars });

                console.log('Tests Passed!');

                await executionsCollection.updateOne(
                    { taskId: taskId },
                    {
                        $set: {
                            status: 'PASSED',
                            endTime: new Date(),
                            output: stdout
                        }
                    }
                );
            } catch (error: any) {
                console.error('Tests Failed!');
                await executionsCollection.updateOne(
                    { taskId: taskId },
                    {
                        $set: {
                            status: 'FAILED',
                            endTime: new Date(),
                            error: error.stderr || error.stdout || error.message
                        }
                    }
                );
            } finally {
                channel!.ack(msg);
                console.log('------------------------------------------------');
            }
        }
    });
}

startWorker();