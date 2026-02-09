import amqp, { Channel } from 'amqplib';

export class RabbitMqService {
    private channel: Channel | null = null;
    private connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;

    async connect() {
        const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
        const maxRetries = 15;
        let retries = maxRetries;
        let delay = 2000; // Start with 2 seconds

        while (retries > 0) {
            try {
                console.log(`Connecting to RabbitMQ at ${RABBITMQ_URL}... (attempt ${maxRetries - retries + 1}/${maxRetries})`);
                this.connection = await amqp.connect(RABBITMQ_URL);
                this.channel = await this.connection.createChannel();
                await this.channel.assertQueue('test_queue', { durable: true });
                console.log('✅ Connected to RabbitMQ');
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

    async sendToQueue(data: object) {
        if (!this.channel) {
            throw new Error('RabbitMQ channel is not established. Call connect() first.');
        }
        this.channel.sendToQueue('test_queue', Buffer.from(JSON.stringify(data)), { persistent: true });
        console.log('Message sent to queue:', data);
    }
}

export const rabbitMqService = new RabbitMqService();