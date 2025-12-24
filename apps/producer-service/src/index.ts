import { Server } from 'socket.io';
import http from 'http';
import fastify from 'fastify';
import cors from '@fastify/cors';
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { rabbitMqService } from './rabbitmq.js';
import { TestExecutionRequestSchema } from '../../../packages/shared-types/index.js';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const app = fastify({ logger: true });

const MONGO_URI = process.env.MONGODB_URL || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'automation_platform';

let dbClient: MongoClient;
let io: Server;

app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

app.post('/executions/update', async (request, reply) => {
    const updateData = request.body as any;
    
    if (io) {
        io.emit('execution-updated', updateData);
        app.log.info(`Broadcasted update for task: ${updateData.taskId}`);
    }

    return { status: 'broadcasted' };
});

app.get('/', async (request, reply) => {
  return { message: 'Producer Service is running!' };
});

async function connectToMongo() {
    try {
        dbClient = new MongoClient(MONGO_URI);
        await dbClient.connect();
        app.log.info('Producer connected to MongoDB (Read-Mode)');
    } catch (error) {
        app.log.error({ msg: 'Failed to connect to Mongo', error });
    }
}

app.get('/executions', async (request, reply) => {
    try {
        if (!dbClient) {
            return reply.status(500).send({ error: 'Database not connected' });
        }

        const collection = dbClient.db(DB_NAME).collection('executions');
        
        const executions = await collection
            .find({})
            .sort({ startTime: -1 })
            .limit(50)
            .toArray();

        return executions;

    } catch (error) {
        app.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch data' });
    }
});

app.post('/execution-request', async (request, reply) => {
  const parseResult = TestExecutionRequestSchema.safeParse(request.body);
  
  if (!parseResult.success) {
    return reply.status(400).send({ error: 'Invalid request payload', details: parseResult.error });
  }

  try {
    await rabbitMqService.sendToQueue(parseResult.data);

    return reply.status(200).send({ 
        status: 'Message queued successfully',
        taskId: parseResult.data.taskId 
    });

  } catch (error) {
    console.error('Error sending message to queue:', error);
    reply.status(500).send({ status: 'Failed to queue message' });
  }

});

app.delete('/executions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
        if (!dbClient) {
            return reply.status(500).send({ error: 'Database not connected' });
        }
        const collection = dbClient.db(DB_NAME).collection('executions');
        const deleteResult = await collection.deleteOne({ taskId: id });
        if (deleteResult.deletedCount === 0) {
            return reply.status(404).send({ error: 'Execution not found' });
        }
        return { status: 'Execution deleted successfully' };
    } catch (error) {
        app.log.error(error);
        return reply.status(500).send({ error: 'Failed to delete execution' });
    }
});

const start = async () => {
  try {
    await app.ready();
    const server = http.createServer(app.server);

    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        app.log.info('📺 Dashboard connected via Socket.io');
    });

    console.log('Connecting to RabbitMQ...');
    await rabbitMqService.connect();
    await connectToMongo();
    await app.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Producer & Socket.io running on port 3000');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();