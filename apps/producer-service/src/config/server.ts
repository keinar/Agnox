import fastify, { FastifyInstance } from 'fastify';
import socketio from 'fastify-socket.io';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { MongoClient } from 'mongodb';
import type { Server } from 'socket.io';
import * as fs from 'fs';
import * as path from 'path';
import { verifyToken } from '../utils/jwt.js';

declare module 'fastify' {
    interface FastifyInstance {
        io: Server;
    }
}

const MONGO_URI = process.env.MONGODB_URL || process.env.MONGO_URI || 'mongodb://automation-mongodb:27017/automation_platform';
const DB_NAME = 'automation_platform';

let dbClient: MongoClient;

/**
 * MongoDB connection
 */
export async function connectToMongo(app: FastifyInstance): Promise<MongoClient> {
    try {
        dbClient = new MongoClient(MONGO_URI);
        await dbClient.connect();
        app.log.info('Producer connected to MongoDB');
        return dbClient;
    } catch (error) {
        app.log.error({ msg: 'Failed to connect to Mongo', error });
        throw error;
    }
}

export function getDbClient(): MongoClient {
    return dbClient;
}

export function getDbName(): string {
    return DB_NAME;
}

/**
 * Create and configure Fastify server with plugins
 */
export function createServer(): FastifyInstance {
    const app = fastify({ logger: true });

    // CORS Configuration (Task 4.4: Production CORS)
    const rawAllowedOrigins = process.env.ALLOWED_ORIGINS || '';
    const defaultDevOrigins = ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000'];

    const ALLOWED_ORIGINS = rawAllowedOrigins
        ? rawAllowedOrigins.split(',').map(origin => origin.trim())
        : defaultDevOrigins;

    app.register(cors, {
        origin: (origin, callback) => {
            // Allow requests with no origin (e.g., mobile apps, Postman, server-to-server)
            if (!origin) {
                return callback(null, true);
            }

            // Check if origin is in allowed list
            if (ALLOWED_ORIGINS.includes(origin)) {
                callback(null, true);
            } else {
                app.log.warn({ event: 'CORS_BLOCKED', origin, allowed: ALLOWED_ORIGINS });
                return callback(null, false);
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    });

    // Socket.IO plugin
    app.register(socketio, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // Static file serving for reports
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

    return app;
}

/**
 * Configure Socket.IO connection handler with JWT authentication
 */
export function setupSocketIO(app: FastifyInstance): void {
    app.io.on('connection', (socket) => {
        // Extract JWT token from handshake
        const token = socket.handshake.auth?.token;

        if (!token) {
            app.log.warn(`Socket connection rejected: No token provided (socket: ${socket.id})`);
            socket.emit('auth-error', { error: 'Authentication required' });
            socket.disconnect();
            return;
        }

        // Verify JWT token
        const payload = verifyToken(token);

        if (!payload) {
            app.log.warn(`Socket connection rejected: Invalid token (socket: ${socket.id})`);
            socket.emit('auth-error', { error: 'Invalid or expired token' });
            socket.disconnect();
            return;
        }

        // Multi-tenant: Join organization-specific room
        const orgRoom = `org:${payload.organizationId}`;
        socket.join(orgRoom);

        app.log.info(`✅ Socket ${socket.id} connected for user ${payload.userId} (${payload.role}) in organization ${payload.organizationId}`);
        app.log.info(`   Joined room: ${orgRoom}`);

        // Send confirmation to client
        socket.emit('auth-success', {
            message: 'Connected to organization channel',
            organizationId: payload.organizationId,
            userId: payload.userId,
            role: payload.role
        });

        socket.on('disconnect', () => {
            app.log.info(`Socket ${socket.id} disconnected from room ${orgRoom}`);
        });
    });
}
