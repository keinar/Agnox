import { vi } from 'vitest';
import * as fs from 'fs';

const sharedMocks = vi.hoisted(() => {
    return {
        mockUpdateOne: vi.fn(),
        mockFindOne: vi.fn().mockResolvedValue({ aiAnalysisEnabled: true }),
        mockContainerRemove: vi.fn(),
        mockContainerStart: vi.fn(),
        mockContainerWait: vi.fn().mockResolvedValue({ StatusCode: 0 }),
        mockContainerLogs: vi.fn().mockResolvedValue({
            pipe: vi.fn(),
            on: vi.fn((event: string, cb: Function) => {
                if (event === 'data') {
                    cb(Buffer.from("Test logs\n"));
                }
            }),
        }),
        mockContainerGetArchive: vi.fn().mockResolvedValue({
            pipe: vi.fn(),
        })
    }
});
Object.assign(globalThis, sharedMocks);

const { mockUpdateOne, mockFindOne, mockContainerRemove, mockContainerStart, mockContainerWait, mockContainerLogs, mockContainerGetArchive } = sharedMocks;

// Mock dependencies
vi.mock('amqplib', () => ({
    default: {
        connect: vi.fn().mockResolvedValue({
            createChannel: vi.fn().mockResolvedValue({
                assertQueue: vi.fn(),
                prefetch: vi.fn(),
                consume: vi.fn(),
                nack: vi.fn(),
                ack: vi.fn(),
            }),
        }),
    },
}));

// Mock FS
vi.mock('fs', async () => {
    const actual = await vi.importActual('fs') as any;
    return {
        ...actual,
        existsSync: vi.fn().mockReturnValue(false),
        mkdirSync: vi.fn(),
        rmSync: vi.fn(),
        renameSync: vi.fn(),
    };
});

vi.mock('mongodb', () => ({
    MongoClient: class {
        connect = vi.fn().mockResolvedValue(true);
        db = vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
                findOne: mockFindOne,
                updateOne: mockUpdateOne,
            }),
        });
    },
    ObjectId: class { constructor(id: string) { } },
}));

vi.mock('dockerode', () => ({
    default: class {
        getImage = vi.fn().mockReturnValue({
            inspect: vi.fn().mockResolvedValue({}),
        });
        createContainer = vi.fn().mockResolvedValue({
            start: mockContainerStart,
            wait: mockContainerWait,
            logs: mockContainerLogs,
            remove: mockContainerRemove,
            getArchive: mockContainerGetArchive
        });
        pull = vi.fn((image: string, cb: Function) => cb(null, {}));
        modem = {
            followProgress: vi.fn((stream: any, cb: Function) => cb(null, {}))
        };
    }
}));

vi.mock('tar-fs', () => ({
    extract: vi.fn().mockReturnValue({
        on: vi.fn((event: string, cb: Function) => {
            if (event === 'finish') {
                setTimeout(cb, 0);
            }
        }),
    }),
}));

vi.mock('ioredis', () => ({
    default: class {
        lpush = vi.fn().mockResolvedValue('OK');
        ltrim = vi.fn().mockResolvedValue('OK');
    }
}));

vi.mock('../src/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Global fetch mock to prevent notifyProducer from hanging
global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })) as any;

vi.mock('../src/ai/analyze', () => ({
    analyzeTestFailure: vi.fn().mockResolvedValue('Mocked AI Analysis result.'),
}));

vi.mock('../src/utils/crypto', () => ({
    decrypt: vi.fn().mockReturnValue('mock-decrypted-token'),
}));

vi.mock('../src/ci/providerFactory', () => ({
    ProviderFactory: {
        getProvider: vi.fn().mockReturnValue({
            postPrComment: vi.fn().mockResolvedValue(true),
        }),
    },
}));

vi.mock('child_process', () => ({
    execFileSync: vi.fn(),
}));
