import amqp, { Channel, ConsumeMessage } from 'amqplib';
import { MongoClient } from 'mongodb';
import { exec } from 'child_process';
import util from 'util';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const execPromise = util.promisify(exec);

const MONGO_URI = process.env.MONGODB_URL || process.env.MONGO_URI || 'mongodb://localhost:27017';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const DB_NAME = 'automation_platform';
const COLLECTION_NAME = 'executions';
const reportsBaseUrl = process.env.PUBLIC_API_URL || 'http://localhost:3000';


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
            const reportsDir = process.env.REPORTS_DIR || path.join(process.cwd(), 'test-results');
            const baseTaskDir = path.join(reportsDir, taskId);
            const finalAllureResultsDir = path.join(baseTaskDir, 'allure-results');
            const finalAllureReportDir = path.join(baseTaskDir, 'allure-report');
            const finalHtmlReportDir = path.join(baseTaskDir, 'playwright-report');
            const outputDir = path.join(baseTaskDir, 'raw-assets');
            
            const localAllureResults = path.join(process.cwd(), 'allure-results');
            const localHtmlReport = path.join(process.cwd(), 'playwright-report');

            console.log('------------------------------------------------');
            console.log(`📥 Processing Task: ${taskId}`);

            try {
                if (fs.existsSync(localAllureResults)) fs.rmSync(localAllureResults, { recursive: true, force: true });
                if (fs.existsSync(localHtmlReport)) fs.rmSync(localHtmlReport, { recursive: true, force: true });
            } catch (e) {}

            try {
                fs.mkdirSync(outputDir, { recursive: true });
                fs.mkdirSync(finalAllureResultsDir, { recursive: true });
            } catch (err) {}

            const startTime = new Date();
            
            await executionsCollection.updateOne(
                { taskId: taskId },
                { $set: { status: 'RUNNING', startTime: startTime, config: task.config, tests: task.tests } },
                { upsert: true }
            );

            await notifyProducer({ 
                taskId, 
                status: 'RUNNING', 
                startTime: startTime, 
                tests: task.tests 
            });

            try {
                const testPaths = task.tests.join(' ');
                
                const command = `npx playwright test ${testPaths} --output="${outputDir}" -c playwright.config.ts`;
                console.log(`Executing command: ${command}`);

                const envVars = {
                    ...process.env,
                    BASE_URL: task.config.baseUrl || process.env.BASE_URL,
                    CI: 'true'
                };

                const { stdout } = await execPromise(command, { env: envVars });

                console.log('🚚 Moving reports to task directory...');
                
                if (fs.existsSync(localAllureResults)) {
                    const files = fs.readdirSync(localAllureResults);
                    files.forEach(file => {
                        const srcPath = path.join(localAllureResults, file);
                        const destPath = path.join(finalAllureResultsDir, file);
                        fs.cpSync(srcPath, destPath); 
                        fs.rmSync(srcPath);
                    });
                    console.log(`Moved ${files.length} Allure files.`);
                }

                if (fs.existsSync(localHtmlReport)) {
                    fs.cpSync(localHtmlReport, finalHtmlReportDir, { recursive: true });
                    fs.rmSync(localHtmlReport, { recursive: true, force: true });
                }

                if (fs.readdirSync(finalAllureResultsDir).length > 0) {
                    await execPromise(`npx allure generate "${finalAllureResultsDir}" -o "${finalAllureReportDir}" --clean`);
                    console.log('Allure HTML generated successfully.');
                }

                const passData = { taskId, status: 'PASSED', endTime: new Date(), output: stdout, reportsBaseUrl };
                console.log('Tests Passed!');
                await executionsCollection.updateOne({ taskId }, { $set: passData });
                await notifyProducer(passData);

            } catch (error: any) {
                console.error('Tests Failed');
                try {
                    if (fs.existsSync(localAllureResults)) {
                        const files = fs.readdirSync(localAllureResults);
                        files.forEach(file => {
                            const srcPath = path.join(localAllureResults, file);
                            const destPath = path.join(finalAllureResultsDir, file);
                            fs.cpSync(srcPath, destPath);
                            fs.rmSync(srcPath);
                        });
                        await execPromise(`npx allure generate "${finalAllureResultsDir}" -o "${finalAllureReportDir}" --clean`);
                    }
                } catch (e) {}

                const failData = {
                    taskId,
                    status: 'FAILED',
                    endTime: new Date(),
                    error: error.stderr || error.stdout || error.message,
                    reportsBaseUrl
                };
                await executionsCollection.updateOne({ taskId }, { $set: failData });
                await notifyProducer(failData);
            } finally {
                channel!.ack(msg);
                console.log('------------------------------------------------');
            }
        }
    });
}

async function notifyProducer(executionData: any) {
    const PRODUCER_URL = process.env.PRODUCER_URL || 'http://producer:3000';
    try {
        await fetch(`${PRODUCER_URL}/executions/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(executionData)
        });
        console.log(`[Worker] Notified Producer about task ${executionData.taskId}`);
    } catch (error) {
        console.error('[Worker] Failed to notify Producer:', error.message);
    }
}

startWorker();