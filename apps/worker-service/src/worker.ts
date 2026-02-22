import amqp, { Channel, ConsumeMessage } from 'amqplib';
import { MongoClient, ObjectId } from 'mongodb';
import Docker from 'dockerode';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as tar from 'tar-fs';
import Redis from 'ioredis';
import { analyzeTestFailure } from './analysisService';
import { logger } from './utils/logger.js';

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
            logger.debug({ key }, 'Injecting local env var');
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
    logger.info({ testName, organizationId, durationMs }, 'Updated metrics');
}

async function startWorker() {
    let connection: any = null;
    let channel: Channel | null = null;
    let mongoClient: MongoClient | null = null;

    try {
        mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
        logger.info('Connected to MongoDB');

        connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue('test_queue', { durable: true });
        await channel.prefetch(1);
        logger.info('Connected to RabbitMQ, waiting for jobs');
    } catch (error) {
        logger.error({ error: String(error) }, 'Critical Failure');
        process.exit(1);
    }

    if (!channel || !mongoClient) process.exit(1);

    const db = mongoClient.db(DB_NAME);
    const executionsCollection = db.collection(COLLECTION_NAME);
    const organizationsCollection = db.collection('organizations');

    async function ensureImageExists(image: string) {
        try {
            await docker.getImage(image).inspect();
        } catch (e) {
            logger.info({ image }, 'Image not found locally, pulling');
            await pullImage(image);
        }
    }

    channel.consume('test_queue', async (msg: ConsumeMessage | null) => {
        if (!msg) return;

        const task = JSON.parse(msg.content.toString());
        const { taskId, image: rawImage, command, config, organizationId, groupName, batchId, framework, cycleId, cycleItemId } = task;
        const image = rawImage?.trim();

        if (!image) {
            logger.error({ taskId }, 'Image name is empty or invalid. Rejecting task.');
            channel!.nack(msg, false, false);
            return;
        }

        // Multi-tenant: Use organizationId as STRING (matches JWT and backend)
        if (!organizationId) {
            logger.error({ taskId }, 'Task missing organizationId. Rejecting message.');
            channel!.nack(msg, false, false); // Don't requeue
            return;
        }

        // Multi-tenant: Scope report storage by organization
        const reportsDir = process.env.REPORTS_DIR || path.join(process.cwd(), 'test-results');
        const orgReportsDir = path.join(reportsDir, organizationId);
        const baseTaskDir = path.join(orgReportsDir, taskId);

        if (!fs.existsSync(baseTaskDir)) {
            fs.mkdirSync(baseTaskDir, { recursive: true });
            logger.info({ baseTaskDir }, 'Created org-scoped report directory');
        }

        const startTime = new Date();
        // Multi-tenant: Include organizationId in report URLs
        const apiBaseUrl = process.env.PUBLIC_API_URL || 'http://localhost:3000';
        const currentReportsBaseUrl = `${apiBaseUrl}/reports/${organizationId}`;

        // Fetch organization AI settings at start (for audit trail)
        let initialAiAnalysisEnabled = false;
        try {
            const organization = await organizationsCollection.findOne({
                _id: new ObjectId(organizationId)
            });
            initialAiAnalysisEnabled = organization?.aiAnalysisEnabled !== false;
        } catch (e) {
            logger.warn({ organizationId }, 'Could not fetch org settings at start. Defaulting AI to disabled.');
            initialAiAnalysisEnabled = false;
        }

        // Build the RUNNING update payload, optionally including group fields
        const runningUpdate: Record<string, unknown> = {
            status: 'RUNNING',
            startTime,
            config,
            reportsBaseUrl: currentReportsBaseUrl,
            aiAnalysisEnabled: initialAiAnalysisEnabled,
        };
        if (groupName) runningUpdate.groupName = groupName;
        if (batchId) runningUpdate.batchId = batchId;

        // Notify start (DB update) - Multi-tenant: Filter by organizationId
        await executionsCollection.updateOne(
            { taskId, organizationId },
            { $set: runningUpdate },
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
            reportsBaseUrl: currentReportsBaseUrl,
            aiAnalysisEnabled: initialAiAnalysisEnabled,
            ...(groupName && { groupName }),
            ...(batchId && { batchId }),
        });

        let logsBuffer = "";
        let container: any = null;

        try {
            logger.info({ taskId, image }, 'Orchestrating container for task');

            try {
                logger.info({ image }, 'Attempting to pull image');
                await pullImage(image);
            } catch (pullError: any) {
                logger.warn({ image }, 'Could not pull image. Proceeding with local cache.');
            }

            await ensureImageExists(image);

            // --- Framework-aware command resolution ---
            // 'maestro' is a STUB: the worker queues the correct CLI invocation so that
            // when a Maestro-capable image is provided the execution path is already wired.
            // Full operability (cloud device farm, dedicated mobile worker pool) is Sprint 9.
            let containerCmd: string[];
            if (framework === 'maestro') {
                logger.info({ taskId, framework }, '[Mobile] Maestro framework detected — using stubbed execution path');
                containerCmd = [
                    'maestro',
                    'test',
                    '.',
                    '--format', 'html',
                    '--output', '/app/maestro-reports/report.html',
                ];
            } else {
                // Default: delegate to the agnostic entrypoint script inside the image
                containerCmd = ['/bin/sh', '/app/entrypoint.sh', task.folder || 'all'];
            }
            const agnosticCommand = containerCmd;

            // DEBUG: Trace URL resolution
            logger.info({
                configBaseUrl: config.baseUrl,
                envBaseUrl: process.env.BASE_URL,
                resolvedDockerHost: resolveHostForDocker(config.baseUrl)
            }, '[URL] Resolving target URL');

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
            const hasPassed = /\d+ passed/.test(logsString) || logsString.includes('✓') || logsString.includes('passing (');

            if (finalStatus === 'PASSED') {
                if (hasFailures && hasPassed) {
                    // Mix of passed and failed tests — genuinely unstable/flaky
                    logger.warn({ taskId }, 'Mixed results detected (passed + failed). Marking as UNSTABLE.');
                    finalStatus = 'UNSTABLE';
                } else if (hasFailures) {
                    // Failures detected with no evidence of passing tests — fully failed
                    logger.warn({ taskId }, 'Exit code 0 but only failures detected. Marking as FAILED.');
                    finalStatus = 'FAILED';
                }
                // else: no failures detected, stays PASSED
            } else {
                if (hasRetries && hasPassed && hasFailures) {
                    // Non-zero exit but some tests passed with retries, some failed — mixed
                    logger.warn({ taskId }, 'Mixed results with retries and non-zero exit. Marking as UNSTABLE.');
                    finalStatus = 'UNSTABLE';
                } else {
                    finalStatus = 'FAILED';
                }
            }

            const duration = new Date().getTime() - startTime.getTime();

            // --- AI ANALYSIS START ---
            let analysis = '';
            let aiAnalysisEnabled = false;

            // Fetch organization settings to check AI toggle (Worker-side enforcement)
            try {
                const organization = await organizationsCollection.findOne({
                    _id: new ObjectId(organizationId)
                });

                if (organization) {
                    // Default to true if not explicitly set to false
                    aiAnalysisEnabled = organization.aiAnalysisEnabled !== false;
                    logger.info({ organizationId, aiAnalysisEnabled }, 'Organization AI Analysis setting');
                } else {
                    logger.warn({ organizationId }, 'Organization not found. Defaulting AI Analysis to DISABLED for security.');
                    aiAnalysisEnabled = false;
                }
            } catch (orgError: any) {
                logger.error({ organizationId, error: orgError.message }, 'Failed to fetch organization settings');
                aiAnalysisEnabled = false; // Fail closed: disable AI if can't fetch settings
            }

            if ((finalStatus === 'FAILED' || finalStatus === 'UNSTABLE') && aiAnalysisEnabled) {
                logger.info({ taskId, finalStatus }, 'AI Analysis ENABLED. Starting analysis.');

                // Multi-tenant: Filter by organizationId
                await executionsCollection.updateOne(
                    { taskId, organizationId },
                    { $set: { status: 'ANALYZING', output: logsBuffer, aiAnalysisEnabled } }
                );
                await notifyProducer({
                    taskId,
                    organizationId,  // Include for room-based broadcasting
                    status: 'ANALYZING',
                    output: logsBuffer,
                    reportsBaseUrl: currentReportsBaseUrl,
                    image,
                    aiAnalysisEnabled
                });

                if (!logsBuffer || logsBuffer.length < 50) {
                    analysis = "AI Analysis skipped: Insufficient logs.";
                } else {
                    try {
                        const context = finalStatus === 'UNSTABLE' ? "Note: The test passed after retries (Flaky)." : "";
                        analysis = await analyzeTestFailure(logsBuffer + "\n" + context, image);
                        logger.info({ taskId, analysisLength: analysis.length }, 'AI Analysis completed');
                    } catch (aiError: any) {
                        logger.error({ taskId, error: aiError.message }, 'AI Analysis CRASHED');
                        analysis = `AI Analysis Failed: ${aiError.message}`;
                    }
                }
            } else if ((finalStatus === 'FAILED' || finalStatus === 'UNSTABLE') && !aiAnalysisEnabled) {
                logger.info({ taskId, finalStatus }, 'AI Analysis DISABLED by organization settings. Skipping analysis.');
                analysis = "AI Analysis disabled for this organization.";
            }
            // --- AI ANALYSIS END ---

            logger.info({ taskId, baseTaskDir }, 'Copying artifacts from container');
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
                        logger.debug({ originalFolderName, hostSubDir }, 'Successfully mapped folder');
                    }
                } catch (e) {
                    // Ignore specific missing folders errors
                }
            };

            const mappings = [
                { path: '/app/playwright-report', alias: 'native-report' },
                { path: '/app/pytest-report', alias: 'native-report' },
                { path: '/app/mochawesome-report', alias: 'native-report' },
                // Maestro (mobile) — stub: artifact path registered so reports are captured
                // automatically once a Maestro-capable image is used in Sprint 9.
                { path: '/app/maestro-reports', alias: 'native-report' },
                { path: '/app/allure-results', alias: 'allure-results' },
                { path: '/app/allure-report', alias: 'allure-report' },
                { path: '/app/test-results', alias: 'test-results' },
            ];

            for (const m of mappings) {
                await copyAndRenameFolder(m.path, m.alias);
            }

            // Generate Allure Report if results exist (Platform-side generation)
            const allureResultsDir = path.join(baseTaskDir, 'allure-results');
            const allureReportDir = path.join(baseTaskDir, 'allure-report');

            if (fs.existsSync(allureResultsDir) && !fs.existsSync(allureReportDir)) {
                logger.info({ taskId, organizationId }, '[Allure] Generating report from results...');
                try {
                    const { execSync } = require('child_process');
                    execSync(
                        `allure generate "${allureResultsDir}" --clean -o "${allureReportDir}"`,
                        { stdio: 'pipe' }
                    );
                    logger.info({ taskId, organizationId }, '[Allure] Report generated successfully');
                } catch (err: any) {
                    logger.error({ taskId, organizationId, error: err.stderr?.toString() || err.message }, '[Allure] Generation failed');
                }
            }

            // Multi-tenant: Pass organizationId to scope metrics by org
            await updatePerformanceMetrics(image, duration, organizationId);

            const endTime = new Date();

            // Perform existence checks for reports
            const hasNativeReport = fs.existsSync(path.join(baseTaskDir, 'native-report', 'index.html'));
            const hasAllureReport = fs.existsSync(path.join(baseTaskDir, 'allure-report', 'index.html'));

            const updateData: Record<string, unknown> = {
                taskId,
                organizationId,  // Include for room-based broadcasting
                status: finalStatus,
                endTime,
                output: logsBuffer,
                reportsBaseUrl: currentReportsBaseUrl,
                image,
                command,
                analysis: analysis,
                aiAnalysisEnabled,  // Audit trail: Record whether AI was enabled for this execution
                hasNativeReport,
                hasAllureReport
            };

            // Forward cycle linkage so the producer can update the parent TestCycle
            if (cycleId) updateData.cycleId = cycleId;
            if (cycleItemId) updateData.cycleItemId = cycleItemId;

            // Multi-tenant: Filter by organizationId
            await executionsCollection.updateOne(
                { taskId, organizationId },
                { $set: updateData }
            );
            await notifyProducer(updateData);
            logger.info({ taskId, organizationId, finalStatus }, 'Task finished');

        } catch (error: any) {
            logger.error({ taskId, organizationId, error: error.message }, 'Container orchestration failure');

            // Fetch AI setting even for errors (for audit trail)
            let aiAnalysisEnabledForError = false;
            try {
                const organization = await organizationsCollection.findOne({
                    _id: new ObjectId(organizationId)
                });
                aiAnalysisEnabledForError = organization?.aiAnalysisEnabled !== false;
            } catch (e) {
                aiAnalysisEnabledForError = false;
            }

            const errorData: Record<string, unknown> = {
                taskId,
                organizationId,  // Include for room-based broadcasting
                status: 'ERROR',
                error: error.message,
                output: logsBuffer,
                endTime: new Date(),
                aiAnalysisEnabled: aiAnalysisEnabledForError  // Audit trail
            };

            // Forward cycle linkage so the producer can update the parent TestCycle
            if (cycleId) errorData.cycleId = cycleId;
            if (cycleItemId) errorData.cycleItemId = cycleItemId;
            // Multi-tenant: Filter by organizationId
            await executionsCollection.updateOne(
                { taskId, organizationId },
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
        logger.error('Failed to notify Producer');
    }
}

// ============================================================================
// MOBILE READINESS REPORT — Sprint 8 architectural summary (printed once at boot)
// Full Maestro operability is planned for Sprint 9.
// ============================================================================
function printMobileReadinessReport(): void {
    logger.info('========================================================');
    logger.info(' MOBILE AUTOMATION READINESS REPORT — Sprint 8 Stub     ');
    logger.info('========================================================');
    logger.info('Framework registered : Maestro (mobile-native)');
    logger.info('Current status       : STUB — execution path wired, image not bundled');
    logger.info('');
    logger.info('ARCHITECTURAL CHANGES REQUIRED IN SPRINT 9');
    logger.info('--------------------------------------------------');
    logger.info('1. DEDICATED MOBILE WORKER POOL');
    logger.info('   Mobile tests require a real device or emulator. The current');
    logger.info('   Docker-based worker pool cannot host Android/iOS sessions.');
    logger.info('   Action: Provision a separate worker type (e.g. EC2 metal or');
    logger.info('   macOS runner) that routes tasks where framework==="maestro".');
    logger.info('');
    logger.info('2. CLOUD DEVICE FARM INTEGRATION');
    logger.info('   For scalable parallel execution, integrate with a cloud device');
    logger.info('   farm (e.g. BrowserStack App Automate, AWS Device Farm, or');
    logger.info('   LambdaTest Real Devices). Maestro supports remote execution');
    logger.info('   via the --device flag pointing to a remote ADB/iOS endpoint.');
    logger.info('   Action: Add DEVICE_FARM_URL + DEVICE_FARM_TOKEN env vars to the');
    logger.info('   mobile worker config and pass --device $DEVICE_FARM_URL to the CLI.');
    logger.info('');
    logger.info('3. MAESTRO-CAPABLE DOCKER IMAGE');
    logger.info('   A lightweight image must include: JDK 17+, Maestro CLI, and the');
    logger.info('   ability to connect to a remote device. NO Android SDK / emulator');
    logger.info('   should be bundled into this image to keep it small.');
    logger.info('   Suggested base: eclipse-temurin:17-jre-jammy + maestro install script.');
    logger.info('');
    logger.info('4. REPORT PARSING');
    logger.info('   Maestro outputs HTML to /app/maestro-reports/report.html.');
    logger.info('   The artifact mapping is already registered (this sprint).');
    logger.info('   Action: Verify the Dashboard "native-report" viewer renders');
    logger.info('   Maestro HTML correctly and add a framework badge to the UI.');
    logger.info('');
    logger.info('5. QUEUE ROUTING');
    logger.info('   A new RabbitMQ queue (e.g. "mobile_queue") should be declared');
    logger.info('   so mobile jobs never compete with browser-based jobs for workers.');
    logger.info('   Action: Update the producer to route framework==="maestro" tasks');
    logger.info('   to the mobile_queue; add a mobile worker that consumes it.');
    logger.info('========================================================');
}

printMobileReadinessReport();
startWorker();