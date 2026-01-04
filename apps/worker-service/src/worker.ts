import amqp, { Channel, ConsumeMessage } from 'amqplib';
import { MongoClient } from 'mongodb';
import Docker from 'dockerode';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import Redis from 'ioredis';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const MONGO_URI = process.env.MONGODB_URL || process.env.MONGO_URI || 'mongodb://localhost:27017';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const DB_NAME = 'automation_platform';
const COLLECTION_NAME = 'executions';
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

async function updatePerformanceMetrics(testName: string, durationMs: number) {
    const key = `metrics:test:${testName}`;
    
    const history = await redis.lpush(key, durationMs);
    await redis.ltrim(key, 0, 9);
    
    console.log(`[Redis] Updated metrics for ${testName}. Duration: ${durationMs}ms`);
}

async function startWorker() {
    let connection: any = null;
    let channel: Channel | null = null;
    let mongoClient: MongoClient | null = null;

    try {
        mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
        console.log('👷 Worker: Connected to MongoDB');

        connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue('test_queue', { durable: true });
        await channel.prefetch(1);
        console.log('👷 Worker: Connected to RabbitMQ, waiting for jobs...');
    } catch (error) {
        console.error('Critical Failure:', error);
        process.exit(1);
    }

    if (!channel || !mongoClient) process.exit(1);

    const db = mongoClient.db(DB_NAME);
    const executionsCollection = db.collection(COLLECTION_NAME);

    channel.consume('test_queue', async (msg: ConsumeMessage | null) => {
        if (!msg) return;

        const task = JSON.parse(msg.content.toString());
        const { taskId, image, command, config } = task;

        // Setup results directory on the host
        const reportsDir = process.env.REPORTS_DIR || path.join(process.cwd(), 'test-results');
        const baseTaskDir = path.join(reportsDir, taskId);

        if (!fs.existsSync(baseTaskDir)) fs.mkdirSync(baseTaskDir, { recursive: true });

        const startTime = new Date();
        const currentReportsBaseUrl = process.env.PUBLIC_API_URL || 'http://localhost:3000';

        // Initialize execution status in DB
        await executionsCollection.updateOne(
            { taskId },
            { $set: { status: 'RUNNING', startTime, config, reportsBaseUrl: currentReportsBaseUrl } },
            { upsert: true }
        );

        await notifyProducer({ 
            taskId, 
            status: 'RUNNING', 
            startTime,
            image,
            command,
            config,
            reportsBaseUrl: currentReportsBaseUrl
        });

        let logsBuffer = ""; // Capture container output

        try {
            console.log(`🚀 Orchestrating container for task: ${taskId} using image: ${image}`);

            // Attempt to pull the image, but continue if it fails (allows local images)
            try {
                console.log(`Attempting to pull image: ${image}...`);
                await pullImage(image);
            } catch (pullError: any) {
                console.warn(`⚠️ Could not pull image ${image}. Proceeding with local cache.`);
            }

            const container = await docker.createContainer({
                Image: image,
                Tty: true,
                Cmd: command.split(' '),
                Env: [
                    `BASE_URL=${config.baseUrl || process.env.BASE_URL}`,
                    `TASK_ID=${taskId}`,
                    `CI=true`,
                    // Inject Infrastructure Variables from the Manager to the Test Container
                    `MONGO_URI=${process.env.MONGO_URI || ''}`,
                    `MONGODB_URL=${process.env.MONGO_URI || ''}`,
                    `GEMINI_API_KEY=${process.env.GEMINI_API_KEY || ''}`,
                    `ADMIN_USER=${process.env.ADMIN_USER || ''}`,
                    `ADMIN_PASS=${process.env.ADMIN_PASS || ''}`,
                    // Inject any custom vars sent from the Dashboard
                    ...(Object.entries(config.envVars || {}).map(([k, v]) => `${k}=${v}`))
                ],
                HostConfig: {
                    // Map the task directory to the container's results folder
                    Binds: [`${baseTaskDir}:/app/results`],
                    AutoRemove: true
                },
                WorkingDir: '/app'
            });

            await container.start();

            // Stream and capture logs
            const logStream = await container.logs({ follow: true, stdout: true, stderr: true });
            
            logStream.on('data', (chunk: Buffer) => {
                let logLine = chunk.toString();

                const cleanLine = stripAnsi(logLine);
                
                logsBuffer += cleanLine;

                sendLogToProducer(taskId, cleanLine).catch(() => { });
            });

            logStream.pipe(process.stdout);

            // Wait for container to finish execution
            const result = await container.wait();
            const status = result.StatusCode === 0 ? 'PASSED' : 'FAILED';
            const duration = new Date().getTime() - startTime.getTime();
            await updatePerformanceMetrics(image, duration);

            const endTime = new Date();
            const updateData = { 
                taskId, 
                status, 
                endTime, 
                output: logsBuffer, 
                reportsBaseUrl: currentReportsBaseUrl,
                image, 
                command
            };

            await executionsCollection.updateOne({ taskId }, { $set: updateData });
            await notifyProducer(updateData);
            console.log(`✅ Task ${taskId} finished with status: ${status}`);

        } catch (error: any) {
            console.error(`❌ Container orchestration failure for task ${taskId}:`, error.message);
            const errorData = {
                taskId,
                status: 'ERROR',
                error: error.message,
                output: logsBuffer, // Send logs captured before the crash
                endTime: new Date()
            };
            await executionsCollection.updateOne({ taskId }, { $set: errorData });
            await notifyProducer(errorData);
        } finally {
            channel!.ack(msg);
        }
    });
}

function stripAnsi(text: string) {
    return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

async function sendLogToProducer(taskId: string, log: string) {
    const PRODUCER_URL = process.env.PRODUCER_URL || 'http://producer:3000';
    try {
        await fetch(`${PRODUCER_URL}/executions/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId, log })
        });
    } catch (e) {
        // We don't want to crash the worker if log streaming fails
    }
}

async function pullImage(image: string) {
    return new Promise((resolve, reject) => {
        docker.pull(image, (err: any, stream: any) => {
            if (err) return reject(err);
            docker.modem.followProgress(stream, (err, res) => err ? reject(err) : resolve(res));
        });
    });
}

async function notifyProducer(data: any) {
    const PRODUCER_URL = process.env.PRODUCER_URL || 'http://producer:3000';
    try {
        await fetch(`${PRODUCER_URL}/executions/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (e) {
        console.error('[Worker] Failed to notify Producer');
    }
}

startWorker();