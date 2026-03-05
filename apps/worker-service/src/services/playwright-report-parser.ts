import * as fs from 'fs';
import * as crypto from 'crypto';
import { ITestResult } from '../../../../packages/shared-types/index.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Playwright JSON Reporter Output Types
// Matches the schema produced by PLAYWRIGHT_JSON_OUTPUT_NAME
// ============================================================================

interface PlaywrightResult {
    status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
    duration: number;
    retry: number;
    startTime?: string;
    error?: { message?: string; stack?: string } | null;
}

interface PlaywrightTest {
    /** Outcome across all retries: 'expected' | 'unexpected' | 'flaky' | 'skipped' */
    status: string;
    results: PlaywrightResult[];
}

interface PlaywrightSpec {
    id?: string;
    title: string;
    file?: string;
    line?: number;
    ok?: boolean;
    tests: PlaywrightTest[];
}

interface PlaywrightSuite {
    title: string;
    file?: string;
    suites?: PlaywrightSuite[];
    specs?: PlaywrightSpec[];
}

interface PlaywrightJsonReport {
    suites?: PlaywrightSuite[];
}

// ============================================================================
// Helpers
// ============================================================================

function hashError(message: string): string {
    // Normalise minor variance (line numbers, temp IDs) before hashing
    const normalized = message.slice(0, 200).replace(/\d+/g, 'N');
    return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

/**
 * Map Playwright's test-level outcome status to ITestResult.status.
 * The last result's status (final attempt) is the ground truth.
 */
function resolveStatus(test: PlaywrightTest): ITestResult['status'] {
    const lastResult = test.results[test.results.length - 1];
    if (!lastResult) {
        // Fallback: use outer status
        if (test.status === 'expected') return 'passed';
        if (test.status === 'skipped') return 'skipped';
        return 'failed';
    }
    const s = lastResult.status;
    if (s === 'passed') return 'passed';
    if (s === 'timedOut') return 'timedOut';
    if (s === 'skipped') return 'skipped';
    return 'failed';
}

/**
 * Flatten a spec into an ITestResult using the last retry result for
 * status and duration.
 */
function specToTestResult(spec: PlaywrightSpec, filePath: string): ITestResult | null {
    if (!spec.tests || spec.tests.length === 0) return null;

    const test = spec.tests[0]; // one spec → one playwright test object
    const lastResult = test.results[test.results.length - 1];

    if (lastResult?.error) {
        if (lastResult.error.message) {
            lastResult.error.message = lastResult.error.message.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
        }
        if (lastResult.error.stack) {
            lastResult.error.stack = lastResult.error.stack.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
        }
    }

    const status = resolveStatus(test);
    const duration = lastResult?.duration ?? 0;
    const errorMessage = lastResult?.error?.message?.trim() ?? null;

    const testId = spec.id || crypto
        .createHash('sha256')
        .update(`${filePath}::${spec.title}`)
        .digest('hex')
        .slice(0, 16);

    const result: ITestResult = {
        testId,
        name: spec.title,
        status,
        duration,
        error: errorMessage || null,
        timestamp: lastResult?.startTime ? new Date(lastResult.startTime).getTime() : undefined,
        attemptCount: test.results.length,
    };

    if (errorMessage) {
        result.errorHash = hashError(errorMessage);
    }

    return result;
}

/** Recursively walk suites and collect all specs. */
function collectSpecs(
    suite: PlaywrightSuite,
    parentFile: string,
    out: ITestResult[],
): void {
    const file = suite.file || parentFile;

    for (const spec of suite.specs ?? []) {
        const result = specToTestResult(spec, file);
        if (result) out.push(result);
    }

    for (const child of suite.suites ?? []) {
        collectSpecs(child, file, out);
    }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Parse a Playwright JSON reporter output file and return an array of
 * ITestResult objects suitable for persisting to the executions collection.
 *
 * Returns null when the file does not exist (e.g. the run crashed before
 * Playwright could write it) so the caller can decide how to handle it.
 */
export function parsePlaywrightReport(reportPath: string): ITestResult[] | null {
    if (!fs.existsSync(reportPath)) {
        logger.warn({ reportPath }, '[playwright-parser] JSON report not found — test results will not be enriched');
        return null;
    }

    let raw: string;
    try {
        raw = fs.readFileSync(reportPath, 'utf8');
    } catch (err: any) {
        logger.error({ reportPath, error: err.message }, '[playwright-parser] Failed to read JSON report file');
        return null;
    }

    let report: PlaywrightJsonReport;
    try {
        report = JSON.parse(raw);
    } catch (err: any) {
        logger.error({ reportPath, error: err.message }, '[playwright-parser] Failed to parse JSON report — not valid JSON');
        return null;
    }

    const results: ITestResult[] = [];

    if (!report.suites) {
        logger.warn('[JSON] Parser warning: report.suites is undefined. Returning empty array.');
    }

    for (const suite of report.suites ?? []) {
        collectSpecs(suite, suite.file || suite.title, results);
    }

    if (results.length === 0) {
        logger.warn({ reportPath }, '[playwright-parser] Parsed 0 test results from report — file may be empty or malformed');
    } else {
        logger.info({ reportPath, count: results.length }, '[playwright-parser] Parsed test results successfully');
    }

    return results;
}
