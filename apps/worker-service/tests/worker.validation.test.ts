import { describe, it, expect, vi, afterEach } from 'vitest';
import { startWorker, TaskMessageSchema } from '../src/worker';
import { logger } from '../src/utils/logger';

describe('worker.validation.test - RabbitMQ Message Validation', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('B-001: Malformed JSON in RabbitMQ message is rejected without requeue', async () => {
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
});
