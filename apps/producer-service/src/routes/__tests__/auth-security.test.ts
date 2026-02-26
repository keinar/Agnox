import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import supertest from 'supertest';
import { FastifyInstance } from 'fastify';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';

// 1. Mock External Services
vi.mock('../../rabbitmq.js', () => ({
    rabbitMqService: {
        connect: vi.fn(),
        sendToQueue: vi.fn(),
    }
}));

// Create an in-memory Redis state for realistic mocking
const redisState: Record<string, string | number> = {};

const globalMockRedis = {
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn(async (key) => redisState[key] || null),
    set: vi.fn(async (key, value) => { redisState[key] = value; return 'OK'; }),
    exists: vi.fn(async (key) => key in redisState ? 1 : 0),
    ttl: vi.fn(async (key) => key in redisState ? 900 : -2),
    incr: vi.fn(async (key) => {
        redisState[key] = (Number(redisState[key]) || 0) + 1;
        return redisState[key];
    }),
    expire: vi.fn(async (key, seconds) => 1),
    setex: vi.fn(async (key, seconds, value) => {
        redisState[key] = value;
        return 'OK';
    }),
    del: vi.fn(async (key) => {
        const existed = key in redisState;
        delete redisState[key];
        return existed ? 1 : 0;
    }),
    publish: vi.fn(),
    lrange: vi.fn().mockResolvedValue([]),
} as any;

vi.mock('../../config/redis.js', () => ({
    redis: globalMockRedis
}));

describe('Auth Security Routes - Hardening', () => {
    let app: FastifyInstance;
    let mongoServer: MongoMemoryServer;
    let dbClient: MongoClient;
    let db: any;

    const JWT_SECRET = process.env.PLATFORM_JWT_SECRET || 'test-secret';

    const testOrgId = new ObjectId().toString();
    const bobUserId = new ObjectId().toString();
    const bobEmail = 'bob@test.com';
    const bobPassword = 'Password123!';

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
        const { hashPassword } = await import('../../utils/password');

        // Init App
        console.log('[TEST] Creating Fastify Server...');
        app = createServer();
        console.log('[TEST] Connecting to Mongo DB Client...');
        dbClient = await connectToMongo(app);
        db = dbClient.db();
        console.log('[TEST] Mongo DB connected.');

        // Null Rate Limiters for Testing
        const mockRateLimiter = async () => { };

        console.log('[TEST] Setting up Fastify Routes...');
        await setupRoutes(
            app,
            dbClient,
            globalMockRedis, // Pass our stateful redis mock
            mockRateLimiter, // authRateLimit
            mockRateLimiter, // apiRateLimit
            mockRateLimiter  // strictRateLimit
        );
        console.log('[TEST] Setting up Global Auth...');
        setupGlobalAuth(app, mockRateLimiter);

        console.log('[TEST] Awaiting app.ready()...');
        await app.ready();
        console.log('[TEST] app is ready.');

        console.log('[TEST] Seeding user collection for lockout test...');
        const hashedPassword = await hashPassword(bobPassword);

        await db.collection('users').insertOne({
            _id: new ObjectId(bobUserId),
            organizationId: new ObjectId(testOrgId),
            email: bobEmail,
            hashedPassword,
            name: 'Bob Tester',
            role: 'developer',
            status: 'active',
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

    it('A-004 (API): Account Lockout after 5 failed login attempts', async () => {
        // 1. Make 5 failed login attempts
        for (let i = 0; i < 5; i++) {
            const response = await supertest(app.server)
                .post('/api/auth/login')
                .send({ email: bobEmail, password: 'WrongPassword123!' });

            expect(response.status).toBe(401);
            expect(response.body).toEqual({
                success: false,
                error: 'Invalid credentials',
                message: 'Email or password is incorrect'
            });
        }

        // 2. Make the 6th attempt perfectly correct, but it should be rejected due to lockout
        const lockedResponse = await supertest(app.server)
            .post('/api/auth/login')
            .send({ email: bobEmail, password: bobPassword }); // Correct password!

        expect(lockedResponse.status).toBe(429); // The route uses 429 for account temporarily locked
        expect(lockedResponse.body).toEqual(expect.objectContaining({
            success: false,
            error: 'Account temporarily locked',
            retryAfter: expect.any(Number)
        }));

        expect(lockedResponse.body.message).toMatch(/Too many failed login attempts/);

        // 3. Verify Redis State explicitly
        const lockKey = `login_lock:${bobEmail}`;
        expect(redisState[lockKey]).toBe('1'); // Exists
    });
});
