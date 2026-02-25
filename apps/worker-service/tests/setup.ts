import { vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.REPORTS_DIR = '/tmp/reports';
process.env.PRODUCER_URL = 'http://producer:3000';
process.env.PLATFORM_JWT_SECRET = 'test-jwt-secret';
process.env.PLATFORM_WORKER_CALLBACK_SECRET = 'test-callback-secret';

// Stub logger to avoid console spam during unit testing
vi.mock('../src/utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }
}));

// Mock setup globally
vi.mock('dockerode');
vi.mock('amqplib');
vi.mock('@google/generative-ai');
vi.mock('mongodb', () => ({
    MongoClient: vi.fn(),
    ObjectId: vi.fn((id) => id || '000000000000000000000001')
}));
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })));
