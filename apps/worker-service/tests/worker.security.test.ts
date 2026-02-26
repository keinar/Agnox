import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { normalizeFolder, resolveHostForDocker, getMergedEnvVars } from '../src/worker';

describe('worker.security.test - Security & Path Normalizations', () => {
    describe('B-003: Windows Path Backslash Is Normalized', () => {
        it('should normalize windows backslashes to forward slashes', () => {
            expect(normalizeFolder('tests\\e2e\\login')).toBe('tests/e2e/login');
            expect(normalizeFolder(undefined)).toBe('all');
        });
    });

    describe('B-008: localhost URL in Docker Container Is Rewritten', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            process.env = { ...originalEnv };
        });

        afterEach(() => {
            process.env = originalEnv;
        });

        it('should rewrite localhost only if RUNNING_IN_DOCKER=true', () => {
            process.env.RUNNING_IN_DOCKER = 'true';
            expect(resolveHostForDocker('http://localhost:8080/api')).toBe('http://host.docker.internal:8080/api');
            expect(resolveHostForDocker('http://127.0.0.1:3000')).toBe('http://host.docker.internal:3000');

            process.env.RUNNING_IN_DOCKER = 'false';
            expect(resolveHostForDocker('http://localhost:8080/api')).toBe('http://localhost:8080/api');
        });
    });

    describe('B-009 & B-010: Environment Variable Security Blocklists', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            process.env = { ...originalEnv };
        });

        afterEach(() => {
            process.env = originalEnv;
        });

        it('B-009: PLATFORM_* Secrets Are Blocked from Container Environment Variables', () => {
            process.env.INJECT_ENV_VARS = 'PLATFORM_JWT_SECRET,PLATFORM_MONGO_URI,APP_FEATURE_FLAG';
            process.env.PLATFORM_JWT_SECRET = 'super-secret';
            process.env.PLATFORM_MONGO_URI = 'mongodb://hack:me';
            process.env.APP_FEATURE_FLAG = 'v2-enabled';

            const merged = getMergedEnvVars({ envVars: {}, baseUrl: "http://localhost" }, "http://target");

            expect(merged.PLATFORM_JWT_SECRET).toBeUndefined();
            expect(merged.PLATFORM_MONGO_URI).toBeUndefined();
            expect(merged.APP_FEATURE_FLAG).toBe('v2-enabled');
            expect(merged.CI).toBe('true');
            expect(merged.BASE_URL).toBe('http://target');
        });

        it('B-010: User-Supplied envVars Containing PLATFORM_* Key Are Silently Dropped', () => {
            const taskEnv = { PLATFORM_JWT_SECRET: "injected", MY_KEY: "ok" };
            const merged = getMergedEnvVars({ envVars: taskEnv }, "http://target");

            expect(merged.PLATFORM_JWT_SECRET).toBeUndefined();
            expect(merged.MY_KEY).toBe('ok');
        });
    });
});
