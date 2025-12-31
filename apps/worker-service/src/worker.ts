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
            } catch (e) { }

            try {
                fs.mkdirSync(outputDir, { recursive: true });
            } catch (err) { }

            const startTime = new Date();
            // Get the URL from environment variable
            const currentReportsBaseUrl = process.env.PUBLIC_API_URL || 'http://localhost:3000';

            // IMPORTANT: Save the baseUrl immediately when starting
            await executionsCollection.updateOne(
                { taskId: taskId },
                { 
                    $set: { 
                        status: 'RUNNING', 
                        startTime: startTime, 
                        config: task.config, 
                        tests: task.tests,
                        reportsBaseUrl: currentReportsBaseUrl 
                    } 
                },
                { upsert: true }
            );

            await notifyProducer({
                taskId,
                status: 'RUNNING',
                startTime: startTime,
                tests: task.tests,
                reportsBaseUrl: currentReportsBaseUrl
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

                // 1. Allure Results
                if (fs.existsSync(localAllureResults)) {
                    try {
                        if (!fs.existsSync(finalAllureResultsDir)) fs.mkdirSync(finalAllureResultsDir, { recursive: true });
                        const files = fs.readdirSync(localAllureResults);
                        for (const file of files) {
                            fs.copyFileSync(path.join(localAllureResults, file), path.join(finalAllureResultsDir, file));
                            fs.unlinkSync(path.join(localAllureResults, file));
                        }
                        await execPromise(`npx allure generate "${finalAllureResultsDir}" -o "${finalAllureReportDir}" --clean`);
                    } catch (err) {
                        console.error('Failed to process Allure reports:', err);
                    }
                }

                // 2. Playwright HTML
                if (fs.existsSync(localHtmlReport)) {
                    try {
                        if (!fs.existsSync(finalHtmlReportDir)) fs.mkdirSync(finalHtmlReportDir, { recursive: true });
                        fs.cpSync(localHtmlReport, finalHtmlReportDir, { recursive: true, force: true });
                        fs.rmSync(localHtmlReport, { recursive: true, force: true });
                    } catch (err) {
                        console.error('Failed to move Playwright HTML report:', err);
                    }
                }

                // 3. Permissions
                try {
                    await execPromise(`chmod -R 755 "${baseTaskDir}"`);
                } catch (e) { }

                const passData = { 
                    taskId, 
                    status: 'PASSED', 
                    endTime: new Date(), 
                    output: stdout, 
                    reportsBaseUrl: currentReportsBaseUrl 
                };
                console.log('Tests Passed!');
                await executionsCollection.updateOne({ taskId }, { $set: passData });
                await notifyProducer(passData);

            } catch (error: any) {
                console.error('Tests Failed');
                
                try {
                    if (fs.existsSync(localAllureResults)) {
                        if (!fs.existsSync(finalAllureResultsDir)) fs.mkdirSync(finalAllureResultsDir, { recursive: true });
                        fs.readdirSync(localAllureResults).forEach(file => {
                            fs.copyFileSync(path.join(localAllureResults, file), path.join(finalAllureResultsDir, file));
                            fs.unlinkSync(path.join(localAllureResults, file));
                        });
                        await execPromise(`npx allure generate "${finalAllureResultsDir}" -o "${finalAllureReportDir}" --clean`);
                    }
                    if (fs.existsSync(localHtmlReport)) {
                         if (!fs.existsSync(finalHtmlReportDir)) fs.mkdirSync(finalHtmlReportDir, { recursive: true });
                         fs.cpSync(localHtmlReport, finalHtmlReportDir, { recursive: true, force: true });
                         fs.rmSync(localHtmlReport, { recursive: true, force: true });
                    }
                    await execPromise(`chmod -R 755 "${baseTaskDir}"`);
                } catch (e) { }

                const failData = {
                    taskId,
                    status: 'FAILED',
                    endTime: new Date(),
                    error: error.stderr || error.stdout || error.message,
                    reportsBaseUrl: currentReportsBaseUrl
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
    } catch (error: any) {
        console.error('[Worker] Failed to notify Producer');
    }
}

startWorker();