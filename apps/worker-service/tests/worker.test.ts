import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveHostForDocker, containsFatalPattern, sendLogToProducer, determineExecutionStatus, normalizeFolder, startWorker, TaskMessageSchema, getMergedEnvVars } from '../src/worker';
import { logger } from '../src/utils/logger';

// Mock dependencies
vi.mock('amqplib', () => ({
    default: {
        connect: vi.fn().mockResolvedValue({
            createChannel: vi.fn().mockResolvedValue({
                assertQueue: vi.fn(),
                prefetch: vi.fn(),
                consume: vi.fn(),
                nack: vi.fn(),
                ack: vi.fn(),
            }),
        }),
    },
}));

import * as fs from 'fs';

// Mock FS
vi.mock('fs', async () => {
    const actual = await vi.importActual('fs');
    return {
        ...actual,
        existsSync: vi.fn().mockReturnValue(false),
        mkdirSync: vi.fn(),
        rmSync: vi.fn(),
        renameSync: vi.fn(),
    };
});

const { mockUpdateOne, mockFindOne, mockContainerRemove, mockContainerStart, mockContainerWait, mockContainerLogs, mockContainerGetArchive } = vi.hoisted(() => {
    return {
        mockUpdateOne: vi.fn(),
        mockFindOne: vi.fn().mockResolvedValue({ aiAnalysisEnabled: true }),
        mockContainerRemove: vi.fn(),
        mockContainerStart: vi.fn(),
        mockContainerWait: vi.fn().mockResolvedValue({ StatusCode: 0 }),
        mockContainerLogs: vi.fn().mockResolvedValue({
            pipe: vi.fn(),
            on: vi.fn((event, cb) => {
                if (event === 'data') {
                    cb(Buffer.from("Test logs\n"));
                }
            }),
        }),
        mockContainerGetArchive: vi.fn().mockResolvedValue({
            pipe: vi.fn(),
        })
    }
});

vi.mock('mongodb', () => ({
    MongoClient: class {
        connect = vi.fn().mockResolvedValue(true);
        db = vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
                findOne: mockFindOne,
                updateOne: mockUpdateOne,
            }),
        });
    },
    ObjectId: class { constructor(id: string) { } },
}));

vi.mock('dockerode', () => ({
    default: class {
        getImage = vi.fn().mockReturnValue({
            inspect: vi.fn().mockResolvedValue({}),
        });
        createContainer = vi.fn().mockResolvedValue({
            start: mockContainerStart,
            wait: mockContainerWait,
            logs: mockContainerLogs,
            remove: mockContainerRemove,
            getArchive: mockContainerGetArchive
        });
        pull = vi.fn((image, cb) => cb(null, {}));
        modem = {
            followProgress: vi.fn((stream, cb) => cb(null, {}))
        };
    }
}));

vi.mock('tar-fs', () => ({
    extract: vi.fn().mockReturnValue({
        on: vi.fn((event, cb) => {
            if (event === 'finish') {
                setTimeout(cb, 0);
            }
        }),
    }),
}));

vi.mock('ioredis', () => ({
    default: class {
        lpush = vi.fn().mockResolvedValue('OK');
        ltrim = vi.fn().mockResolvedValue('OK');
    }
}));

vi.mock('../src/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Global fetch mock to prevent notifyProducer from hanging
global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })) as any;

vi.mock('../src/ai/analyze', () => ({
    analyzeTestFailure: vi.fn().mockResolvedValue('Mocked AI Analysis result.'),
}));

vi.mock('../src/utils/crypto', () => ({
    decrypt: vi.fn().mockReturnValue('mock-decrypted-token'),
}));

vi.mock('../src/ci/providerFactory', () => ({
    ProviderFactory: {
        getProvider: vi.fn().mockReturnValue({
            postPrComment: vi.fn().mockResolvedValue(true),
        }),
    },
}));

vi.mock('child_process', () => ({
    execFileSync: vi.fn(),
}));

describe('Suite B — Core Execution Engine', () => {

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('B-001 & B-002: RabbitMQ Message Validation', () => {
        it('B-001: Malformed JSON in RabbitMQ message is rejected without requeue', async () => {
            const amqplib = await import('amqplib');
            const mockConsume = vi.fn();
            const mockNack = vi.fn();

            // Re-mock specifically for this test to capture the callback
            // @ts-ignore
            amqplib.default.connect.mockResolvedValueOnce({
                createChannel: vi.fn().mockResolvedValue({
                    assertQueue: vi.fn(),
                    prefetch: vi.fn(),
                    consume: mockConsume,
                    nack: mockNack,
                    ack: vi.fn(),
                }),
            });

            // Start the worker to bind the consumer
            await startWorker();

            // Extract the message handler
            const consumeCallback = mockConsume.mock.calls[0][1];

            // Trigger handler with malformed JSON
            const badMessage = { content: Buffer.from("not valid json {{ }") };
            await consumeCallback(badMessage);

            expect(mockNack).toHaveBeenCalledWith(badMessage, false, false);
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('SyntaxError') }),
                'RabbitMQ message is not valid JSON. Rejecting.'
            );
        });

        it('B-002: A structurally invalid task message (missing required taskId) is rejected by Zod schema', () => {
            const invalidData = { organizationId: "org1", image: "img:1.0" };
            const parseResult = TaskMessageSchema.safeParse(invalidData);

            expect(parseResult.success).toBe(false);
            if (!parseResult.success) {
                const errorPath = parseResult.error.issues[0].path[0];
                expect(errorPath).toBe('taskId');
            }
        });
    });

    describe('B-004 & B-005 & B-006 & B-007: Log Pattern Status Determination', () => {

        it('B-004: "No tests found" exit code override to ERROR', () => {
            const status = determineExecutionStatus(0, "No tests found in regression suite", "t1");
            expect(status).toBe('ERROR');
            expect(logger.warn).toHaveBeenCalledWith({ taskId: "t1" }, 'No tests found in execution. Marking as ERROR.');
        });

        it('B-005: Exit code 0 with only failures detected -> FAILED', () => {
            const status = determineExecutionStatus(0, "1 failed, 0 passed", "t1");
            expect(status).toBe('FAILED');
            expect(logger.warn).toHaveBeenCalledWith({ taskId: "t1" }, 'Exit code 0 but only failures detected. Marking as FAILED.');
        });

        it('B-006: Mixed pass/fail results produce UNSTABLE', () => {
            const status = determineExecutionStatus(0, "3 passed, 2 failed", "t1");
            expect(status).toBe('UNSTABLE');
            expect(logger.warn).toHaveBeenCalledWith({ taskId: "t1" }, 'Mixed results detected (passed + failed). Marking as UNSTABLE.');
        });

        it('B-007: containsFatalPattern detects FATAL ERROR and forces FAILED', () => {
            const logsBuffer = "Test suite passed\nFATAL ERROR: JavaScript heap out of memory";
            const isFatal = containsFatalPattern(logsBuffer);
            expect(isFatal).toBe(true);

            const status = determineExecutionStatus(0, logsBuffer, "t1");
            expect(status).toBe('FAILED');
            expect(logger.warn).toHaveBeenCalledWith({ taskId: "t1" }, 'Container exited 0 but FATAL ERROR detected in logs. Forcing FAILED.');
        });
    });

    describe('B-003: Windows Path Backslash Is Normalized', () => {
        it('should normalize windows backslashes to forward slashes', () => {
            expect(normalizeFolder('tests\\e2e\\login')).toBe('tests/e2e/login');
            expect(normalizeFolder(undefined)).toBe('all');
        });
    });

    describe('B-008: localhost URL in Docker Container Is Rewritten', () => {
        it('should rewrite localhost only if RUNNING_IN_DOCKER=true', () => {
            process.env.RUNNING_IN_DOCKER = 'true';
            expect(resolveHostForDocker('http://localhost:8080/api')).toBe('http://host.docker.internal:8080/api');
            expect(resolveHostForDocker('http://127.0.0.1:3000')).toBe('http://host.docker.internal:3000');

            process.env.RUNNING_IN_DOCKER = 'false';
            expect(resolveHostForDocker('http://localhost:8080/api')).toBe('http://localhost:8080/api');
        });
    });

    describe('B-012: Real-Time WebSocket Log Streaming Is Delivered Per Org Room', () => {
        beforeEach(() => {
            global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })) as any;
        });

        it('sendLogToProducer sends logs with correct taskId, log, and organizationId', async () => {
            await sendLogToProducer("task-log-test", "test output line", "org-a-id");
            expect(global.fetch).toHaveBeenCalledWith('http://producer:3000/executions/log', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ taskId: "task-log-test", log: "test output line", organizationId: "org-a-id" })
            }));
        });
    });
    describe('B-009 & B-010: Environment Variable Security Blocklists', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            process.env = { ...originalEnv };
        });

        afterEach(() => {
            process.env = originalEnv;
        });

        it('B-009: PLATFORM_* Secrets Are Blocked from Container Environment Variables', () => {
            process.env.INJECT_ENV_VARS = 'PLATFORM_JWT_SECRET,PLATFORM_MONGO_URI,APP_FEATURE_FLAG';
            process.env.PLATFORM_JWT_SECRET = 'super-secret';
            process.env.PLATFORM_MONGO_URI = 'mongodb://hack:me';
            process.env.APP_FEATURE_FLAG = 'v2-enabled';

            const merged = getMergedEnvVars({ envVars: {}, baseUrl: "http://localhost" }, "http://target");

            expect(merged.PLATFORM_JWT_SECRET).toBeUndefined();
            expect(merged.PLATFORM_MONGO_URI).toBeUndefined();
            expect(merged.APP_FEATURE_FLAG).toBe('v2-enabled');
            expect(merged.CI).toBe('true');
            expect(merged.BASE_URL).toBe('http://target');
        });

        it('B-010: User-Supplied envVars Containing PLATFORM_* Key Are Silently Dropped', () => {
            const taskEnv = { PLATFORM_JWT_SECRET: "injected", MY_KEY: "ok" };
            const merged = getMergedEnvVars({ envVars: taskEnv }, "http://target");

            expect(merged.PLATFORM_JWT_SECRET).toBeUndefined();
            expect(merged.MY_KEY).toBe('ok');
        });
    });

    describe('B-011, B-013, B-014, B-015, B-016: Lifecycle Execution Integrity', () => {
        it('B-014: Worker Rejects Task With Empty Image Name', async () => {
            const amqplib = await import('amqplib');
            const mockConsume = vi.fn();
            const mockNack = vi.fn();

            // @ts-ignore
            amqplib.default.connect.mockResolvedValueOnce({
                createChannel: vi.fn().mockResolvedValue({
                    assertQueue: vi.fn(),
                    prefetch: vi.fn(),
                    consume: mockConsume,
                    nack: mockNack,
                    ack: vi.fn(),
                }),
            });

            await startWorker();
            const consumeCallback = mockConsume.mock.calls[0][1];

            const taskMessage = {
                content: Buffer.from(JSON.stringify({
                    taskId: "t1",
                    organizationId: "org1",
                    image: "   " // Empty/whitespace image
                }))
            };

            await consumeCallback(taskMessage);

            expect(mockNack).toHaveBeenCalledWith(taskMessage, false, false);
            expect(logger.error).toHaveBeenCalledWith({ taskId: "t1" }, 'Image name is empty or invalid. Rejecting task.');
        });

        it('B-016: RabbitMQ Prefetch Is Set to 1 (Sequential Processing)', async () => {
            const amqplib = await import('amqplib');
            const mockPrefetch = vi.fn();
            // @ts-ignore
            amqplib.default.connect.mockResolvedValueOnce({
                createChannel: vi.fn().mockResolvedValue({
                    assertQueue: vi.fn(),
                    prefetch: mockPrefetch,
                    consume: vi.fn(),
                }),
            });

            await startWorker();
            expect(mockPrefetch).toHaveBeenCalledWith(1);
        });

        it('B-011 & B-013 & B-015: Happy Path Lifecycle (Org Folders, DB isolation, Cleanup)', async () => {
            const amqplib = await import('amqplib');
            const mockConsume = vi.fn();
            const mockAck = vi.fn();
            const mockPrefetch = vi.fn();

            // @ts-ignore
            amqplib.default.connect.mockResolvedValueOnce({
                createChannel: vi.fn().mockResolvedValue({
                    assertQueue: vi.fn(),
                    prefetch: mockPrefetch,
                    consume: mockConsume,
                    ack: mockAck,
                    nack: vi.fn(),
                }),
            });

            await startWorker();
            const consumeCallback = mockConsume.mock.calls[0][1];

            const taskMessage = {
                content: Buffer.from(JSON.stringify({
                    taskId: "task-001",
                    organizationId: "org-abc",
                    image: "node:latest"
                }))
            };

            await consumeCallback(taskMessage);

            // B-011: Reports are written to org-scoped directory
            // Path checks contain the org id and task id combined correctly.
            expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('org-abc'), expect.any(Object));
            expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('task-001'), expect.any(Object));

            // B-015: Execution Status Transitions cover organizationId filter
            // Validate every updateOne call includes organizationId in filter
            mockUpdateOne.mock.calls.forEach(call => {
                const filter = call[0];
                expect(filter).toHaveProperty('taskId', 'task-001');
                expect(filter).toHaveProperty('organizationId', 'org-abc');
            });

            // Ensure the container.remove and channel.ack are called (B-013 Happy Path + Acknowledgement)
            expect(mockContainerRemove).toHaveBeenCalledWith({ force: true });
            expect(mockAck).toHaveBeenCalledWith(taskMessage);
        });

        it('B-013: Container is force-removed even if an error is thrown during copy', async () => {
            const amqplib = await import('amqplib');
            const mockConsume = vi.fn();
            const mockAck = vi.fn();

            // @ts-ignore
            amqplib.default.connect.mockResolvedValueOnce({
                createChannel: vi.fn().mockResolvedValue({
                    assertQueue: vi.fn(),
                    prefetch: vi.fn(),
                    consume: mockConsume,
                    ack: mockAck,
                    nack: vi.fn(),
                }),
            });

            // Force an error inside the orchestration logic (e.g., waiting fails)
            mockContainerWait.mockRejectedValueOnce(new Error("Container wait crashed"));

            await startWorker();
            const consumeCallback = mockConsume.mock.calls[0][1];

            const taskMessage = {
                content: Buffer.from(JSON.stringify({
                    taskId: "task-error",
                    organizationId: "org-abc",
                    image: "node:latest"
                }))
            };

            await consumeCallback(taskMessage);

            // The finally block should ensure that container cleanup and message ACK still run on error
            expect(mockContainerRemove).toHaveBeenCalledWith({ force: true });
            expect(mockAck).toHaveBeenCalledWith(taskMessage);

            // Verify error status was written to DB (B-015 isolation enforcement on error states)
            expect(mockUpdateOne).toHaveBeenCalledWith(
                { taskId: 'task-error', organizationId: 'org-abc' },
                expect.objectContaining({ $set: expect.objectContaining({ status: 'ERROR' }) })
            );
        });
    });
});
