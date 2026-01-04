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
import * as fs from 'fs';
import Redis from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
}

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const app = fastify({ logger: true });

const MONGO_URI = process.env.MONGODB_URL || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'automation_platform';
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

let dbClient: MongoClient;

app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

app.register(socketio, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const REPORTS_DIR = process.env.REPORTS_DIR || path.join(process.cwd(), 'reports');

if (!fs.existsSync(REPORTS_DIR)) {
    console.log(`⚠️ Reports directory not found at ${REPORTS_DIR}, creating it...`);
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

console.log(`📂 Serving static reports from: ${REPORTS_DIR}`);

app.register(fastifyStatic, {
    root: REPORTS_DIR,
    prefix: '/reports/',
    index: ['index.html'],
    list: false,
    decorateReply: false
});

app.get('/', async () => {
  return { message: 'Agnostic Producer Service is running!' };
});

/**
 * GET Performance insights for a specific image/suite
 */
app.get('/metrics/:image', async (request, reply) => {
    const { image } = request.params as { image: string };
    const key = `metrics:test:${image}`;

    try {
        // Fetch last 10 durations
        const durations = await redis.lrange(key, 0, -1);
        
        if (durations.length === 0) {
            return { averageDuration: 0, status: 'NO_DATA' };
        }

        const numbers = durations.map(Number);
        const sum = numbers.reduce((a, b) => a + b, 0);
        const avg = sum / numbers.length;

        return {
            averageDuration: Math.round(avg),
            lastRunDuration: numbers[0],
            sampleSize: numbers.length,
            // Senior insight: Is the last run significantly slower than average?
            isRegression: numbers[0] > avg * 1.2 // 20% slower than usual
        };
    } catch (error) {
        return reply.status(500).send({ error: 'Failed to fetch metrics' });
    }
});

app.post('/executions/update', async (request, reply) => {
    const updateData = request.body as any;
    app.io.emit('execution-updated', updateData);
    return { status: 'broadcasted' };
});

app.post('/executions/log', async (request, reply) => {
    const { taskId, log } = request.body as { taskId: string; log: string };
    
    // Broadcast the log specifically to the dashboard
    // We use a specific event name 'execution-log'
    app.io.emit('execution-log', { taskId, log });

    return { status: 'ok' };
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
        return reply.status(500).send({ error: 'Failed to fetch data' });
    }
});

/**
 * Agnostic Execution Request
 * supports custom Docker images and commands
 */
app.post('/execution-request', async (request, reply) => {
  const parseResult = TestExecutionRequestSchema.safeParse(request.body);
  
  if (!parseResult.success) {
      return reply.status(400).send({ 
          error: 'Invalid payload', 
          details: parseResult.error.format() 
      });
  }
  
  const { taskId, image, command, tests, config } = parseResult.data;

  try {
    const startTime = new Date();

    if (dbClient) {
        const collection = dbClient.db(DB_NAME).collection('executions');
        await collection.updateOne(
            { taskId }, 
            { 
                $set: { 
                    taskId,
                    image,        // Saved to DB for traceability
                    command,      // Saved to DB for traceability
                    status: 'PENDING',
                    startTime,
                    config,
                    tests: tests || []
                } 
            },
            { upsert: true }
        );
        
        app.io.emit('execution-updated', { 
            taskId, 
            status: 'PENDING', 
            startTime,
            image,
            command,
            config,
            tests: tests || []
        });
    }

    // Send the full agnostic request to RabbitMQ
    await rabbitMqService.sendToQueue(parseResult.data);
    
    app.log.info(`Job ${taskId} queued using image: ${image}`);
    return reply.status(200).send({ status: 'Message queued successfully', taskId });
    
  } catch (error) {
    app.log.error(error);
    reply.status(500).send({ status: 'Failed to queue message' });
  }
});

app.delete('/executions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
        if (!dbClient) return reply.status(500).send({ error: 'Database not connected' });
        const collection = dbClient.db(DB_NAME).collection('executions');
        await collection.deleteOne({ taskId: id });
        return { status: 'Deleted successfully' };
    } catch (error) {
        return reply.status(500).send({ error: 'Failed to delete' });
    }
});

app.get('/tests-structure', async (request, reply) => {
    const testsPath = '/app/tests-source';
    try {
        if (!fs.existsSync(testsPath)) return reply.send([]);
        const items = fs.readdirSync(testsPath, { withFileTypes: true });
        const folders = items.filter(item => item.isDirectory()).map(item => item.name);
        return reply.send(folders);
    } catch (error) {
        return reply.send([]);
    }
});

const start = async () => {
  try {
    await rabbitMqService.connect();
    await connectToMongo();
    await app.listen({ port: 3000, host: '0.0.0.0' });
    
    app.io.on('connection', (socket) => {
        app.log.info('Dashboard connected');
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();