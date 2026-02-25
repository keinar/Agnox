import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveHostForDocker, containsFatalPattern, sendLogToProducer, determineExecutionStatus, normalizeFolder } from '../src/worker';
import { logger } from '../src/utils/logger';

describe('Suite B — Core Execution Engine', () => {
    describe('B-004 & B-005 & B-006 & B-007: Log Pattern Status Determination', () => {

        it('B-004: "No tests found" exit code override to ERROR', () => {
            const status = determineExecutionStatus(0, "No tests found in regression suite", "t1");
            expect(status).toBe('ERROR');
        });

        it('B-005: Exit code 0 with only failures detected -> FAILED', () => {
            const status = determineExecutionStatus(0, "1 failed, 0 passed", "t1");
            expect(status).toBe('FAILED');
        });

        it('B-006: Mixed pass/fail results produce UNSTABLE', () => {
            const status = determineExecutionStatus(0, "3 passed, 2 failed", "t1");
            expect(status).toBe('UNSTABLE');
        });

        it('B-007: containsFatalPattern detects FATAL ERROR and forces FAILED', () => {
            const logsBuffer = "Test suite passed\nFATAL ERROR: JavaScript heap out of memory";
            const isFatal = containsFatalPattern(logsBuffer);
            expect(isFatal).toBe(true);

            const status = determineExecutionStatus(0, logsBuffer, "t1");
            expect(status).toBe('FAILED');
        });
    });

    describe('B-003: Windows Path Backslash Is Normalized', () => {
        it('should normalize windows backslashes to forward slashes', () => {
            expect(normalizeFolder('tests\\e2e\\login')).toBe('tests/e2e/login');
            expect(normalizeFolder(undefined)).toBe('all');
        });
    });

    describe('B-008: localhost URL in Docker Container Is Rewritten', () => {
        it('should rewrite localhost only if RUNNING_IN_DOCKER=true', () => {
            process.env.RUNNING_IN_DOCKER = 'true';
            expect(resolveHostForDocker('http://localhost:8080/api')).toBe('http://host.docker.internal:8080/api');
            expect(resolveHostForDocker('http://127.0.0.1:3000')).toBe('http://host.docker.internal:3000');

            process.env.RUNNING_IN_DOCKER = 'false';
            expect(resolveHostForDocker('http://localhost:8080/api')).toBe('http://localhost:8080/api');
        });
    });

    describe('B-012: Real-Time WebSocket Log Streaming Is Delivered Per Org Room', () => {
        beforeEach(() => {
            global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })) as any;
        });

        it('sendLogToProducer sends logs with correct taskId, log, and organizationId', async () => {
            await sendLogToProducer("task-log-test", "test output line", "org-a-id");
            expect(global.fetch).toHaveBeenCalledWith('http://producer:3000/executions/log', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ taskId: "task-log-test", log: "test output line", organizationId: "org-a-id" })
            }));
        });
    });
});
