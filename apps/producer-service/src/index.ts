import fastify from 'fastify';
import socketio from 'fastify-socket.io';
import cors from '@fastify/cors';
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { rabbitMqService } from './rabbitmq.js';
import { TestExecutionRequestSchema } from '../../../packages/shared-types/index.js';
import fastifyStatic from '@fastify/static';
import type { Server } from 'socket.io';

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
}

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const app = fastify({ logger: true });

const MONGO_URI = process.env.MONGODB_URL || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'automation_platform';

let dbClient: MongoClient;

// 1. Register CORS
app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

// 2. Register Socket.io Plugin
app.register(socketio, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'results'),
    prefix: '/reports/',
    decorateReply: false
});

app.get('/', async () => {
  return { message: 'Producer Service is running with Socket.io!' };
});

// 3. Real-time update endpoint
app.post('/executions/update', async (request, reply) => {
    const updateData = request.body as any;
    
    // Use app.io provided by the plugin
    app.io.emit('execution-updated', updateData);
    app.log.info(`Broadcasted update for task: ${updateData.taskId}`);

    return { status: 'broadcasted' };
});

async function connectToMongo() {
    try {
        dbClient = new MongoClient(MONGO_URI);
        await dbClient.connect();
        app.log.info('Producer connected to MongoDB');
    } catch (error) {
        app.log.error({ msg: 'Failed to connect to Mongo', error });
    }
}

app.get('/executions', async (request, reply) => {
    try {
        if (!dbClient) return reply.status(500).send({ error: 'Database not connected' });
        const collection = dbClient.db(DB_NAME).collection('executions');
        return await collection.find({}).sort({ startTime: -1 }).limit(50).toArray();
    } catch (error) {
        app.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch data' });
    }
});

app.post('/execution-request', async (request, reply) => {
  const parseResult = TestExecutionRequestSchema.safeParse(request.body);
  if (!parseResult.success) return reply.status(400).send({ error: 'Invalid payload', details: parseResult.error });
  try {
    await rabbitMqService.sendToQueue(parseResult.data);
    return reply.status(200).send({ status: 'Message queued successfully', taskId: parseResult.data.taskId });
  } catch (error) {
    reply.status(500).send({ status: 'Failed to queue message' });
  }
});

app.delete('/executions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
        if (!dbClient) return reply.status(500).send({ error: 'Database not connected' });
        const collection = dbClient.db(DB_NAME).collection('executions');
        const deleteResult = await collection.deleteOne({ taskId: id });
        if (deleteResult.deletedCount === 0) return reply.status(404).send({ error: 'Not found' });
        return { status: 'Deleted successfully' };
    } catch (error) {
        return reply.status(500).send({ error: 'Failed to delete' });
    }
});

const start = async () => {
  try {
    console.log('Connecting to Infrastructure...');
    await rabbitMqService.connect();
    await connectToMongo();

    // 4. Listen normally using Fastify's listen
    // The plugin handles the HTTP server wrapping for Socket.io automatically
    await app.listen({ port: 3000, host: '0.0.0.0' });
    
    app.io.on('connection', (socket) => {
        app.log.info('📺 Dashboard connected via Socket.io');
    });

    console.log('🚀 Producer & Socket.io running on port 3000');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();