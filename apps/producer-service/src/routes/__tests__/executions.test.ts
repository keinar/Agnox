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

describe('Execution Routes - RBAC', () => {
    let app: FastifyInstance;
    let mongoServer: MongoMemoryServer;
    let dbClient: MongoClient;
    let db: any;

    const JWT_SECRET = process.env.PLATFORM_JWT_SECRET || 'test-secret';

    const testOrgId = new ObjectId().toString();
    const testExecutionId = 'task-123';

    // A-005 Cross-Tenant Setup
    const testOrgIdB = new ObjectId().toString();
    const testExecutionIdSecret = 'task-org-a-secret';

    // Viewer User Payload (Org A)
    const viewerUser = {
        userId: new ObjectId().toString(),
        organizationId: testOrgId,
        email: 'viewer@test.com',
        role: 'viewer'
    };

    const viewerToken = jwt.sign(viewerUser, JWT_SECRET, {
        expiresIn: '24h',
        issuer: 'agnostic-automation-center',
        audience: 'aac-api'
    });

    // Viewer User Payload (Org B)
    const viewerUserB = {
        userId: new ObjectId().toString(),
        organizationId: testOrgIdB,
        email: 'viewer-b@test.com',
        role: 'viewer'
    };

    const viewerTokenB = jwt.sign(viewerUserB, JWT_SECRET, {
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

        // Seed Database with the execution we "want" to fail to delete
        console.log('[TEST] Seeding executions collection...');
        await db.collection('executions').insertOne({
            taskId: testExecutionId,
            organizationId: testOrgId,
            status: 'FAILED',
            startTime: new Date()
        });

        // Seed Cross-Tenant Secret Execution for A-005 (Belongs to Org A)
        await db.collection('executions').insertOne({
            taskId: testExecutionIdSecret,
            organizationId: testOrgId, // Org A
            status: 'PASSED',
            startTime: new Date()
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

    it('A-006 (API): Viewer Role Cannot Delete Executions', async () => {
        // Try to delete the execution with the viewer's JWT
        const response = await supertest(app.server)
            .delete(`/api/executions/${testExecutionId}`)
            .set('Authorization', `Bearer ${viewerToken}`);

        // 1. Assert Status Code and Error Message
        expect(response.status).toBe(403);
        expect(response.body).toEqual({
            success: false,
            error: 'Insufficient permissions'
        });

        // 2. Assert DB Document still exists and isn't marked as deleted
        const executionInDb = await db.collection('executions').findOne({ taskId: testExecutionId });
        expect(executionInDb).toBeTruthy();
        expect(executionInDb.deletedAt).toBeUndefined();
    });

    it('A-005 (API): Cross-Tenant Execution Access Is Denied', async () => {
        // Try to fetch an execution belonging to Org A using a token from Org B
        const response = await supertest(app.server)
            .get(`/api/executions/${testExecutionIdSecret}`)
            .set('Authorization', `Bearer ${viewerTokenB}`);

        // 1. Assert Status Code is exactly 404 (Not Found) to prevent resource enumeration
        expect(response.status).toBe(404);

        // 2. Assert JSON error matches standard structure
        expect(response.body).toEqual({
            success: false,
            error: 'Execution not found'
        });
    });
});
