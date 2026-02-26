import { describe, it, expect, vi, afterEach } from 'vitest';
import { determineExecutionStatus, containsFatalPattern } from '../src/worker';
import { logger } from '../src/utils/logger';

describe('worker.status.test - Log Pattern Status Determination', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('B-004: "No tests found" exit code override to ERROR', () => {
        const status = determineExecutionStatus(0, "No tests found in regression suite", "t1");
        expect(status).toBe('ERROR');
        expect(logger.warn).toHaveBeenCalledWith({ taskId: "t1" }, 'No tests found in execution. Marking as ERROR.');
    });

    it('B-005: Exit code 0 with only failures detected -> FAILED', () => {
        const status = determineExecutionStatus(0, "1 failed, 0 passed", "t1");
        expect(status).toBe('FAILED');
        expect(logger.warn).toHaveBeenCalledWith({ taskId: "t1" }, 'Exit code 0 but only failures detected. Marking as FAILED.');
    });

    it('B-006: Mixed pass/fail results produce UNSTABLE', () => {
        const status = determineExecutionStatus(0, "3 passed, 2 failed", "t1");
        expect(status).toBe('UNSTABLE');
        expect(logger.warn).toHaveBeenCalledWith({ taskId: "t1" }, 'Mixed results detected (passed + failed). Marking as UNSTABLE.');
    });

    it('B-007: containsFatalPattern detects FATAL ERROR and forces FAILED', () => {
        const logsBuffer = "Test suite passed\nFATAL ERROR: JavaScript heap out of memory";
        const isFatal = containsFatalPattern(logsBuffer);
        expect(isFatal).toBe(true);

        const status = determineExecutionStatus(0, logsBuffer, "t1");
        expect(status).toBe('FAILED');
        expect(logger.warn).toHaveBeenCalledWith({ taskId: "t1" }, 'Container exited 0 but FATAL ERROR detected in logs. Forcing FAILED.');
    });
});
