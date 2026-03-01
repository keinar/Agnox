/**
 * AgnoxReporter — Official Playwright reporter for the Agnox Quality Hub.
 *
 * Implements the Playwright `Reporter` interface and streams live test results
 * to the Agnox Ingest API so they appear in the Dashboard in real-time.
 *
 * GOLDEN RULE: "Do No Harm."
 * If the Agnox API is unreachable, the reporter becomes a silent no-op.
 * The user's test suite is NEVER affected by reporter failures.
 *
 * Usage (playwright.config.ts):
 *   import AgnoxReporter from '@agnox/playwright-reporter';
 *   export default defineConfig({
 *     reporter: [
 *       ['list'],
 *       [AgnoxReporter, {
 *         apiKey:    process.env.AGNOX_API_KEY,
 *         projectId: process.env.AGNOX_PROJECT_ID,
 *       }],
 *     ],
 *   });
 */

import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

import { AgnoxClient } from './client.js';
import { EventBatcher } from './batcher.js';
import type { AgnoxReporterConfig, ICiContext, IngestEvent } from './types.js';

const PACKAGE_VERSION = '1.0.1';

// Playwright's TestResult.status includes 'interrupted' which has no matching
// IngestEvent status — we normalise it to 'failed'.
type PlaywrightStatus = TestResult['status'];
type IngestTestStatus = 'passed' | 'failed' | 'skipped' | 'timedOut';

function toIngestStatus(s: PlaywrightStatus): IngestTestStatus {
  if (s === 'passed' || s === 'failed' || s === 'skipped' || s === 'timedOut') return s;
  return 'failed'; // 'interrupted' → treat as failed
}

interface ResolvedConfig {
  apiKey: string;
  projectId: string;
  baseUrl: string;
  runName: string | undefined;
  environment: 'development' | 'staging' | 'production';
  flushIntervalMs: number;
  maxBatchSize: number;
  debug: boolean;
}

interface RunSummary {
  passed: number;
  failed: number;
  skipped: number;
  startTime: number;
}

export default class AgnoxReporter implements Reporter {
  private readonly client: AgnoxClient;
  private readonly batcher: EventBatcher;
  private readonly cfg: ResolvedConfig;

  /** Set after a successful /setup call. If null, reporter is a no-op. */
  private sessionId: string | null = null;

  /** Accumulated per-test stats — used to build the teardown summary. */
  private readonly summary: RunSummary = {
    passed: 0,
    failed: 0,
    skipped: 0,
    startTime: 0,
  };

  constructor(config: AgnoxReporterConfig) {
    if (!config.apiKey) throw new Error('[agnox] apiKey is required');
    if (!config.projectId) throw new Error('[agnox] projectId is required');

    this.cfg = {
      baseUrl: config.baseUrl ?? 'https://app.agnox.io',
      runName: config.runName,
      environment: config.environment ?? 'production',
      flushIntervalMs: config.flushIntervalMs ?? 2_000,
      maxBatchSize: config.maxBatchSize ?? 50,
      debug: config.debug ?? false,
      apiKey: config.apiKey,
      projectId: config.projectId,
    };

    this.client = new AgnoxClient(this.cfg);

    this.batcher = new EventBatcher({
      flushIntervalMs: this.cfg.flushIntervalMs,
      maxBatchSize: this.cfg.maxBatchSize,
      onFlush: async (events: IngestEvent[]) => {
        if (!this.sessionId) return;
        await this.client.sendEvents({ sessionId: this.sessionId, events });
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Playwright Reporter hooks
  // ---------------------------------------------------------------------------

  async onBegin(_config: FullConfig, suite: Suite): Promise<void> {
    this.summary.startTime = Date.now();

    const res = await this.client.setup({
      projectId: this.cfg.projectId,
      runName: this.cfg.runName,
      framework: 'playwright',
      reporterVersion: PACKAGE_VERSION,
      totalTests: suite.allTests().length,
      environment: this.cfg.environment,
      ciContext: detectCiContext(),
    });

    if (res?.data?.sessionId) {
      this.sessionId = res.data.sessionId;
    }
    // If setup failed, sessionId remains null → all subsequent hooks are no-ops.
  }

  onTestBegin(test: TestCase, _result: TestResult): void {
    if (!this.sessionId) return;

    this.batcher.push({
      type: 'test-begin',
      testId: test.id,
      title: test.titlePath().join(' › '),
      file: test.location.file,
      timestamp: Date.now(),
    });
  }

  onStdOut(chunk: string | Buffer, test?: TestCase, _result?: TestResult): void {
    if (!this.sessionId) return;

    this.batcher.push({
      type: 'log',
      testId: test?.id,
      chunk: chunk.toString(),
      timestamp: Date.now(),
    });
  }

  onStdErr(chunk: string | Buffer, test?: TestCase, _result?: TestResult): void {
    if (!this.sessionId) return;

    this.batcher.push({
      type: 'log',
      testId: test?.id,
      chunk: `[stderr] ${chunk.toString()}`,
      timestamp: Date.now(),
    });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // Always accumulate summary stats — we need them for teardown even if
    // setup succeeded after this hook was first called.
    const ingestStatus = toIngestStatus(result.status);
    if (ingestStatus === 'passed') this.summary.passed++;
    else if (ingestStatus === 'skipped') this.summary.skipped++;
    else this.summary.failed++;

    if (!this.sessionId) return;

    this.batcher.push({
      type: 'test-end',
      testId: test.id,
      status: ingestStatus,
      duration: result.duration,
      error: result.errors[0]?.message,
      timestamp: Date.now(),
    });
  }

  async onEnd(result: FullResult): Promise<void> {
    // Flush remaining buffered events BEFORE sending teardown so the backend
    // receives all test-end events prior to finalising the execution record.
    await this.batcher.drain();

    if (!this.sessionId) return;

    const duration = Date.now() - this.summary.startTime;
    const total = this.summary.passed + this.summary.failed + this.summary.skipped;

    await this.client.teardown({
      sessionId: this.sessionId,
      status: result.status === 'passed' ? 'PASSED' : 'FAILED',
      summary: {
        total,
        passed: this.summary.passed,
        failed: this.summary.failed,
        skipped: this.summary.skipped,
        duration,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// CI Context detection
// Reads standard environment variables set by common CI platforms.
// Returns undefined when running locally without CI env vars.
// ---------------------------------------------------------------------------

function detectCiContext(): ICiContext | undefined {
  // GitHub Actions
  if (process.env['GITHUB_ACTIONS'] === 'true') {
    const repo = process.env['GITHUB_REPOSITORY'];
    const serverUrl = process.env['GITHUB_SERVER_URL'] ?? 'https://github.com';
    const runId = process.env['GITHUB_RUN_ID'];

    // PR number: extract from refs/pull/NUMBER/merge
    let prNumber: number | undefined;
    const ref = process.env['GITHUB_REF'] ?? '';
    const prMatch = /^refs\/pull\/(\d+)\//.exec(ref);
    if (prMatch?.[1]) prNumber = parseInt(prMatch[1], 10);

    return {
      source: 'github',
      repository: repo,
      branch: process.env['GITHUB_REF_NAME'],
      prNumber,
      commitSha: process.env['GITHUB_SHA'],
      runUrl:
        repo && runId
          ? `${serverUrl}/${repo}/actions/runs/${runId}`
          : undefined,
    };
  }

  // GitLab CI
  if (process.env['GITLAB_CI'] === 'true') {
    const prStr = process.env['CI_MERGE_REQUEST_IID'];
    return {
      source: 'gitlab',
      repository: process.env['CI_PROJECT_PATH'],
      branch: process.env['CI_COMMIT_REF_NAME'],
      prNumber: prStr ? parseInt(prStr, 10) : undefined,
      commitSha: process.env['CI_COMMIT_SHA'],
      runUrl: process.env['CI_PIPELINE_URL'],
    };
  }

  // Azure DevOps
  if (process.env['TF_BUILD'] === 'True') {
    const prStr = process.env['SYSTEM_PULLREQUEST_PULLREQUESTNUMBER'];
    return {
      source: 'azure',
      repository: process.env['BUILD_REPOSITORY_NAME'],
      branch: process.env['BUILD_SOURCEBRANCH'],
      prNumber: prStr ? parseInt(prStr, 10) : undefined,
      commitSha: process.env['BUILD_SOURCEVERSION'],
      runUrl: process.env['SYSTEM_TEAMFOUNDATIONSERVERURI'],
    };
  }

  // Jenkins
  if (process.env['JENKINS_URL']) {
    const prStr = process.env['CHANGE_ID'];
    return {
      source: 'jenkins',
      repository: process.env['GIT_URL'],
      branch: process.env['GIT_BRANCH'],
      prNumber: prStr ? parseInt(prStr, 10) : undefined,
      commitSha: process.env['GIT_COMMIT'],
      runUrl: process.env['BUILD_URL'],
    };
  }

  // Generic CI detected but platform unknown → report as 'local'
  if (process.env['CI'] === 'true') {
    return { source: 'local' };
  }

  return undefined;
}
