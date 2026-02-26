import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendLogToProducer, startWorker } from '../src/worker';
import * as fs from 'fs';

const { mockUpdateOne, mockContainerRemove, mockContainerWait } = globalThis as any;

describe('worker.lifecycle.test - Execution Integrity & Orchestration', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('B-012: Real-Time WebSocket Log Streaming Is Delivered Per Org Room', () => {
        it('sendLogToProducer sends logs with correct taskId, log, and organizationId', async () => {
            await sendLogToProducer("task-log-test", "test output line", "org-a-id");
            expect(global.fetch).toHaveBeenCalledWith('http://producer:3000/executions/log', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ taskId: "task-log-test", log: "test output line", organizationId: "org-a-id" })
            }));
        });
    });

    describe('B-011, B-013, B-015, B-016: Lifecycle Execution Integrity', () => {
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
            expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('org-abc'), expect.any(Object));
            expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('task-001'), expect.any(Object));

            // B-015: Execution Status Transitions cover organizationId filter
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
