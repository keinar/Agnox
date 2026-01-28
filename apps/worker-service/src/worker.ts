import amqp, { Channel, ConsumeMessage } from 'amqplib';
import { MongoClient, ObjectId } from 'mongodb';
import Docker from 'dockerode';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as tar from 'tar-fs';
import Redis from 'ioredis';
import { analyzeTestFailure } from './analysisService';

dotenv.config();

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const MONGO_URI = process.env.MONGODB_URL || process.env.MONGO_URI || 'mongodb://localhost:27017';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const DB_NAME = 'automation_platform';
const COLLECTION_NAME = 'executions';
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

function resolveHostForDocker(url: string | undefined): string {
    if (!url) return '';
    if (process.env.RUNNING_IN_DOCKER === 'true' && (url.includes('localhost') || url.includes('127.0.0.1'))) {
        return url.replace(/localhost|127\.0.0.1/, 'host.docker.internal');
    }
    return url;
}

function getMergedEnvVars(configEnv: any = {}) {
    const localKeysToInject = [
        'API_USER', 
        'API_PASSWORD', 
        'BASE_URL', 
        'SECRET_KEY',
        'DB_USER',
        'DB_PASS',
        'MONGO_URI',
        'MONGODB_URL',
        'REDIS_URL',
        'GEMINI_API_KEY'
    ];

    const injectedEnv: string[] = [];

    Object.entries(configEnv).forEach(([k, v]) => {
        let value = v as string;
        if (['BASE_URL', 'MONGO_URI', 'MONGODB_URL'].includes(k)) {
            value = resolveHostForDocker(value);
        }
        injectedEnv.push(`${k}=${value}`);
    });

    localKeysToInject.forEach(key => {
        if (!configEnv[key] && process.env[key]) {
            console.log(`[Worker] Injecting local env var: ${key}`);
            let value = process.env[key]!;
            if (['BASE_URL', 'MONGO_URI', 'MONGODB_URL'].includes(key)) {
                value = resolveHostForDocker(value);
            }
            injectedEnv.push(`${key}=${value}`);
        }
    });

    return injectedEnv;
}

async function updatePerformanceMetrics(testName: string, durationMs: number, organizationId: string) {
    // Multi-tenant: Scope Redis keys by organization
    const key = `metrics:${organizationId}:test:${testName}`;
    await redis.lpush(key, durationMs);
    await redis.ltrim(key, 0, 9);
    console.log(`[Redis] Updated metrics for ${testName} (org: ${organizationId}). Duration: ${durationMs}ms`);
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

    async function ensureImageExists(image: string) {
        try {
            await docker.getImage(image).inspect();
        } catch (e) {
            console.log(`Image ${image} not found locally, pulling...`);
            await pullImage(image);
        }
    }

    channel.consume('test_queue', async (msg: ConsumeMessage | null) => {
        if (!msg) return;

        const task = JSON.parse(msg.content.toString());
        const { taskId, image, command, config, organizationId } = task;

        // Multi-tenant: Convert organizationId string to ObjectId for MongoDB queries
        if (!organizationId) {
            console.error(`[Worker] ERROR: Task ${taskId} missing organizationId. Rejecting message.`);
            channel!.nack(msg, false, false); // Don't requeue
            return;
        }
        const orgId = new ObjectId(organizationId);

        const reportsDir = process.env.REPORTS_DIR || path.join(process.cwd(), 'test-results');
        const baseTaskDir = path.join(reportsDir, taskId);

        if (!fs.existsSync(baseTaskDir)) fs.mkdirSync(baseTaskDir, { recursive: true });

        const startTime = new Date();
        const currentReportsBaseUrl = process.env.PUBLIC_API_URL || 'http://localhost:3000';

        // Notify start (DB update) - Multi-tenant: Filter by organizationId
        await executionsCollection.updateOne(
            { taskId, organizationId: orgId },
            { $set: { status: 'RUNNING', startTime, config, reportsBaseUrl: currentReportsBaseUrl } },
            { upsert: true }
        );

        // Notify start (Socket broadcast - with full details for instant UI update)
        await notifyProducer({
            taskId,
            organizationId,  // Include for room-based broadcasting
            status: 'RUNNING',
            startTime,
            image,
            command,
            config,
            reportsBaseUrl: currentReportsBaseUrl
        });

        let logsBuffer = "";
        let container: any = null;

  try {
            console.log(`Orchestrating container for task: ${taskId} using image: ${image}`);

            try {
                console.log(`Attempting to pull image: ${image}...`);
                await pullImage(image);
            } catch (pullError: any) {
                console.warn(`Could not pull image ${image}. Proceeding with local cache.`);
            }

            await ensureImageExists(image);
            const agnosticCommand = ['/bin/sh', '/app/entrypoint.sh', task.folder || 'all'];
            const targetBaseUrl = resolveHostForDocker(config.baseUrl || process.env.BASE_URL || 'http://host.docker.internal:3000');

            // Multi-tenant: Include organizationId in container name for isolation
            const containerName = `org_${organizationId}_task_${taskId}`;

            container = await docker.createContainer({
                name: containerName,
                Image: image,
                Tty: true,
                Cmd: agnosticCommand,
                Env: [
                    `BASE_URL=${targetBaseUrl}`,
                    `TASK_ID=${taskId}`,
                    `CI=true`,
                    `FRAMEWORK_AGNOSTIC=true`,
                    ...getMergedEnvVars(config.envVars)
                ],
                HostConfig: {
                    AutoRemove: false, // CRITICAL: Must be false so we can copy files after exit
                    ExtraHosts: process.platform === 'linux' ? ['host.docker.internal:host-gateway'] : undefined
                },
                WorkingDir: '/app'
            });

            await container.start();

            // Logs streaming setup
            const logStream = await container.logs({ follow: true, stdout: true, stderr: true });

            // Pipe logs to worker console
            logStream.pipe(process.stdout);

            logStream.on('data', (chunk: Buffer) => {
                let logLine = chunk.toString();
                const cleanLine = stripAnsi(logLine);
                logsBuffer += cleanLine;
                // Multi-tenant: Include organizationId in log broadcasts
                sendLogToProducer(taskId, cleanLine, organizationId).catch(() => { });
            });

            // 1. Wait for execution to finish
            const result = await container.wait();
            let finalStatus = result.StatusCode === 0 ? 'PASSED' : 'FAILED';
            const logsString = logsBuffer;
            const hasFailures = logsString.includes('failed') || logsString.includes('✘');
            const hasRetries = logsString.includes('retry #');
            
            if (finalStatus === 'PASSED') {
                if (hasFailures && !hasRetries) {
                    console.warn(`[Worker] ⚠️ Exit code 0 but failures detected. Marking as FAILED.`);
                    finalStatus = 'FAILED';
                } else if (hasRetries) {
                    console.warn(`[Worker] ⚠️ Retries detected. Marking as UNSTABLE.`);
                    finalStatus = 'UNSTABLE'; 
                }
            } else {
                finalStatus = 'FAILED';
            }

            const duration = new Date().getTime() - startTime.getTime();

            // --- AI ANALYSIS START ---
            let analysis = '';
            if (finalStatus === 'FAILED' || finalStatus === 'UNSTABLE') {
                console.log(`[Worker] Task status is ${finalStatus}. Reporting analysis start...`);

                // Multi-tenant: Filter by organizationId
                await executionsCollection.updateOne(
                    { taskId, organizationId: orgId },
                    { $set: { status: 'ANALYZING', output: logsBuffer } }
                );
                await notifyProducer({
                    taskId,
                    organizationId,  // Include for room-based broadcasting
                    status: 'ANALYZING',
                    output: logsBuffer,
                    reportsBaseUrl: currentReportsBaseUrl,
                    image
                });

                if (!logsBuffer || logsBuffer.length < 50) {
                     analysis = "AI Analysis skipped: Insufficient logs.";
                } else {
                    try {
                        const context = finalStatus === 'UNSTABLE' ? "Note: The test passed after retries (Flaky)." : "";
                        analysis = await analyzeTestFailure(logsBuffer + "\n" + context, image);
                        console.log(`[Worker] AI Analysis completed (${analysis.length} chars).`);
                    } catch (aiError: any) {
                        console.error('[Worker] AI Analysis CRASHED:', aiError.message);
                        analysis = `AI Analysis Failed: ${aiError.message}`;
                    }
                }
            }
            // --- AI ANALYSIS END ---

            console.log(`Copying artifacts from container to ${baseTaskDir}...`);
            const copyAndRenameFolder = async (containerPath: string, hostSubDir: string) => {
                try {
                    const stream = await container.getArchive({ path: containerPath });
                    const extract = tar.extract(baseTaskDir);
                    stream.pipe(extract);

                    await new Promise((resolve, reject) => {
                        extract.on('finish', resolve);
                        extract.on('error', reject);
                    });

                    const originalFolderName = path.basename(containerPath);
                    const fullPathOnHost = path.join(baseTaskDir, originalFolderName);
                    const targetPathOnHost = path.join(baseTaskDir, hostSubDir);

                    if (fs.existsSync(fullPathOnHost) && originalFolderName !== hostSubDir) {
                        if (fs.existsSync(targetPathOnHost)) fs.rmSync(targetPathOnHost, { recursive: true });
                        fs.renameSync(fullPathOnHost, targetPathOnHost);
                        console.log(`Successfully mapped ${originalFolderName} to ${hostSubDir}`);
                    }
                } catch (e) {
                    // Ignore specific missing folders errors
                }
            };

            const mappings = [
                { path: '/app/playwright-report', alias: 'native-report' },
                { path: '/app/pytest-report', alias: 'native-report' },
                { path: '/app/mochawesome-report', alias: 'native-report' },
                { path: '/app/allure-results', alias: 'allure-results' },
                { path: '/app/allure-report', alias: 'allure-report' }
            ];

            for (const m of mappings) {
                await copyAndRenameFolder(m.path, m.alias);
            }

            // Multi-tenant: Pass organizationId to scope metrics by org
            await updatePerformanceMetrics(image, duration, organizationId);

            const endTime = new Date();

            const updateData = {
                taskId,
                organizationId,  // Include for room-based broadcasting
                status: finalStatus,
                endTime,
                output: logsBuffer,
                reportsBaseUrl: currentReportsBaseUrl,
                image,
                command,
                analysis: analysis
            };

            // Multi-tenant: Filter by organizationId
            await executionsCollection.updateOne(
                { taskId, organizationId: orgId },
                { $set: updateData }
            );
            await notifyProducer(updateData);
            console.log(`✅ Task ${taskId} (org: ${organizationId}) finished with status: ${finalStatus}`);

        } catch (error: any) {
            console.error(`❌ Container orchestration failure for task ${taskId} (org: ${organizationId}):`, error.message);
            const errorData = {
                taskId,
                organizationId,  // Include for room-based broadcasting
                status: 'ERROR',
                error: error.message,
                output: logsBuffer,
                endTime: new Date()
            };
            // Multi-tenant: Filter by organizationId
            await executionsCollection.updateOne(
                { taskId, organizationId: orgId },
                { $set: errorData }
            );
            await notifyProducer(errorData);
        } finally {
            // Manual cleanup since AutoRemove is false
            if (container) {
                try {
                    await container.remove({ force: true });
                } catch (e) { }
            }
            channel!.ack(msg);
        }
    });
}

function stripAnsi(text: string) {
    return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

async function sendLogToProducer(taskId: string, log: string, organizationId: string) {
    const PRODUCER_URL = process.env.PRODUCER_URL || 'http://producer:3000';
    try {
        await fetch(`${PRODUCER_URL}/executions/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Multi-tenant: Include organizationId for room-based broadcasting
            body: JSON.stringify({ taskId, log, organizationId })
        });
    } catch (e) { }
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