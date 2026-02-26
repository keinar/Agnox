import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import supertest from 'supertest';
import { FastifyInstance } from 'fastify';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';

// 1. Mock External Services
vi.mock('../../rabbitmq.js', () => ({
    rabbitMqService: {
        connect: vi.fn(),
        sendToQueue: vi.fn(),
    }
}));

vi.mock('../../config/redis.js', () => ({
    redis: {
        ping: vi.fn().mockResolvedValue('PONG'),
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue('OK'),
        publish: vi.fn(),
        lrange: vi.fn().mockResolvedValue([]),
    }
}));

describe('User Management Routes - RBAC', () => {
    let app: FastifyInstance;
    let mongoServer: MongoMemoryServer;
    let dbClient: MongoClient;
    let db: any;

    const JWT_SECRET = process.env.PLATFORM_JWT_SECRET || 'test-secret';

    // A-007 Setup
    const orgIdA007 = new ObjectId().toString();
    const developerUserId = new ObjectId().toString();
    const targetUserIdA007 = new ObjectId().toString();

    const developerUser = {
        userId: developerUserId,
        organizationId: orgIdA007,
        email: 'dev@test.com',
        role: 'developer'
    };

    const developerToken = jwt.sign(developerUser, JWT_SECRET, {
        expiresIn: '24h',
        issuer: 'agnostic-automation-center',
        audience: 'aac-api'
    });

    // A-008 Setup
    const orgIdA008 = new ObjectId().toString();
    const lastAdminUserId = new ObjectId().toString();

    const adminUser = {
        userId: lastAdminUserId,
        organizationId: orgIdA008,
        email: 'admin@test.com',
        role: 'admin'
    };

    const adminToken = jwt.sign(adminUser, JWT_SECRET, {
        expiresIn: '24h',
        issuer: 'agnostic-automation-center',
        audience: 'aac-api'
    });

    beforeAll(async () => {
        console.log('[TEST] Starting beforeAll...');
        // Ensure standard testing env vars
        process.env.PLATFORM_JWT_SECRET = JWT_SECRET;

        // Setup In-Memory MongoDB
        console.log('[TEST] Creating MongoMemoryServer...');
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        console.log(`[TEST] MongoMemoryServer created at ${mongoUri}`);

        // CRITICAL: Force the app to use the in-memory URI BEFORE importing server config
        process.env.PLATFORM_MONGO_URI = mongoUri;
        process.env.MONGODB_URL = mongoUri;

        // Dynamically import server modules now that env vars are set
        console.log('[TEST] Importing server modules...');
        const { createServer, connectToMongo } = await import('../../config/server');
        const { setupRoutes } = await import('../../config/routes');
        const { setupGlobalAuth } = await import('../../config/middleware');

        // Init App
        console.log('[TEST] Creating Fastify Server...');
        app = createServer();
        console.log('[TEST] Connecting to Mongo DB Client...');
        dbClient = await connectToMongo(app);
        db = dbClient.db();
        console.log('[TEST] Mongo DB connected.');

        // Null Rate Limiters for Testing
        const mockRateLimiter = async () => { };

        // Mock Redis Dependency explicitly handled in setupRoutes
        const mockRedis: any = { ping: vi.fn(), get: vi.fn(), set: vi.fn() };

        console.log('[TEST] Setting up Fastify Routes...');
        await setupRoutes(
            app,
            dbClient,
            mockRedis,
            mockRateLimiter, // authRateLimit
            mockRateLimiter, // apiRateLimit
            mockRateLimiter  // strictRateLimit
        );
        console.log('[TEST] Setting up Global Auth...');
        setupGlobalAuth(app, mockRateLimiter);

        console.log('[TEST] Awaiting app.ready()...');
        await app.ready();
        console.log('[TEST] app is ready.');

        console.log('[TEST] Seeding users collection...');

        // Seed A-007 data
        await db.collection('users').insertMany([
            {
                _id: new ObjectId(developerUserId),
                organizationId: orgIdA007,
                email: 'dev@test.com',
                role: 'developer',
                createdAt: new Date()
            },
            {
                _id: new ObjectId(targetUserIdA007),
                organizationId: orgIdA007,
                email: 'target@test.com',
                role: 'viewer',
                createdAt: new Date()
            }
        ]);

        // Seed A-008 data
        await db.collection('users').insertOne({
            _id: new ObjectId(lastAdminUserId),
            organizationId: orgIdA008,
            email: 'admin@test.com',
            role: 'admin',
            createdAt: new Date()
        });

        console.log('[TEST] beforeAll complete!');
    }, 60000); // 60 seconds timeout

    afterAll(async () => {
        if (app) {
            await app.close();
        }
        if (dbClient) {
            await dbClient.close();
        }
        if (mongoServer) {
            await mongoServer.stop();
        }
    });

    it('A-007 (API): Non-Admin Cannot Change Another User\'s Role', async () => {
        const response = await supertest(app.server)
            .patch(`/api/users/${targetUserIdA007}/role`)
            .set('Authorization', `Bearer ${developerToken}`)
            .send({ role: 'admin' });

        // 1. Assert Status Code and Error Message
        expect(response.status).toBe(403);
        expect(response.body).toEqual({
            success: false,
            error: 'Insufficient permissions',
            message: 'This action requires one of the following roles: admin. Your role: developer.'
        });

        // 2. Assert DB Document still exists and role hasn't changed
        const userInDb = await db.collection('users').findOne({ _id: new ObjectId(targetUserIdA007) });
        expect(userInDb).toBeTruthy();
        expect(userInDb.role).toBe('viewer'); // Remains viewer
    });

    it('A-008 (API): Admin Cannot Demote the Last Admin', async () => {
        const response = await supertest(app.server)
            .patch(`/api/users/${lastAdminUserId}/role`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'developer' });

        // 1. Assert Status Code and Error Message
        // Notice users.ts returns 403 for this specific business rule
        expect(response.status).toBe(403);
        expect(response.body).toEqual({
            success: false,
            error: 'Cannot change own role',
            message: 'You cannot change your own role'
        });

        // 2. Assert DB Document still exists and role hasn't changed
        const userInDb = await db.collection('users').findOne({ _id: new ObjectId(lastAdminUserId) });
        expect(userInDb).toBeTruthy();
        expect(userInDb.role).toBe('admin'); // Remains admin
    });
});
