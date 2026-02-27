import amqp, { Channel } from 'amqplib';

// ── Queue configuration ────────────────────────────────────────────────────────
//
// ⚠️  MIGRATION NOTE (one-time, before first deploy of this version):
//     The queue `test_queue` must be declared with `x-max-priority: 10` for
//     fair scheduling. If the queue already exists WITHOUT this argument,
//     RabbitMQ will reject the re-declaration with PRECONDITION_FAILED.
//
//     Before deploying:
//       1. Stop all producers and workers.
//       2. Open the RabbitMQ management UI (port 15672).
//       3. Navigate to Queues → test_queue → Delete.
//       4. Restart producers and workers — the queue is recreated automatically.
//
const QUEUE_NAME = 'test_queue';
const QUEUE_OPTIONS = {
    durable: true,
    arguments: { 'x-max-priority': 10 },
} as const;

export class RabbitMqService {
    private channel: Channel | null = null;
    private connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;

    async connect() {
        const RABBITMQ_URL = process.env.PLATFORM_RABBITMQ_URL || process.env.RABBITMQ_URL || 'amqp://localhost';
        const maxRetries = 15;
        let retries = maxRetries;
        let delay = 2000; // Start with 2 seconds

        while (retries > 0) {
            try {
                console.log(`Connecting to RabbitMQ at ${RABBITMQ_URL}... (attempt ${maxRetries - retries + 1}/${maxRetries})`);
                this.connection = await amqp.connect(RABBITMQ_URL);
                this.channel = await this.connection.createChannel();
                await this.channel.assertQueue(QUEUE_NAME, QUEUE_OPTIONS);
                console.log('✅ Connected to RabbitMQ (priority queue, x-max-priority=10)');
                return;
            } catch (error) {
                console.error(`Failed to connect to RabbitMQ (retry in ${delay / 1000}s):`, (error as Error).message);
                retries--;
                await new Promise(res => setTimeout(res, delay));
                delay = Math.min(delay * 1.5, 10000); // Exponential backoff, max 10s
            }
        }
        console.error('❌ Could not connect to RabbitMQ after multiple attempts.');
        process.exit(1);
    }

    /**
     * Enqueue a task message with a fairness priority (1 = lowest, 10 = highest).
     * Higher-priority messages are delivered to workers before lower-priority ones,
     * ensuring no single organization can monopolise the worker pool.
     */
    async sendToQueue(data: object, priority: number = 1) {
        if (!this.channel) {
            throw new Error('RabbitMQ channel is not established. Call connect() first.');
        }
        const clampedPriority = Math.max(1, Math.min(10, Math.round(priority)));
        this.channel.sendToQueue(
            QUEUE_NAME,
            Buffer.from(JSON.stringify(data)),
            { persistent: true, priority: clampedPriority },
        );
        console.log(`Message sent to queue (priority=${clampedPriority}):`, data);
    }

    /**
     * Enqueue a background image pre-fetch task.
     * The worker will run `docker pull <image>` without creating an execution record.
     * Pre-fetch tasks always run at minimum priority (1) so they never displace real work.
     */
    async sendPrefetchTask(image: string, organizationId: string): Promise<void> {
        await this.sendToQueue({
            type: 'PREFETCH_IMAGE',
            image,
            organizationId,
        }, 1);
    }

    /**
     * Return live queue metrics for the monitoring API.
     * Uses amqplib's passive `checkQueue` which never creates or mutates the queue.
     */
    async getQueueStats(): Promise<{ messageCount: number; consumerCount: number }> {
        if (!this.channel) {
            throw new Error('RabbitMQ channel is not established. Call connect() first.');
        }
        const info = await this.channel.checkQueue(QUEUE_NAME);
        return {
            messageCount: info.messageCount,
            consumerCount: info.consumerCount,
        };
    }
}

export const rabbitMqService = new RabbitMqService();
