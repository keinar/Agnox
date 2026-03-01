// ============================================================================
// PUBLIC CONFIG — exposed to the user in playwright.config.ts
// ============================================================================

export interface AgnoxReporterConfig {
  /** Your Agnox API key (from Settings → API Keys). Required. */
  apiKey: string;
  /** The Agnox Project ID to associate this run with. Required. */
  projectId: string;
  /** Agnox API base URL. Defaults to 'https://dev.agnox.dev'. */
  baseUrl?: string;
  /** Human-readable label for this run (e.g. "PR #42 smoke tests"). */
  runName?: string;
  /** Target environment for the run. Defaults to 'production'. */
  environment?: 'development' | 'staging' | 'production';
  /** How often to flush buffered events to the API, in ms. Defaults to 2000. */
  flushIntervalMs?: number;
  /** Maximum events per batch before a size-triggered flush. Defaults to 50. */
  maxBatchSize?: number;
  /** Log Agnox reporter activity to stderr. Defaults to false. */
  debug?: boolean;
}

// ============================================================================
// INTERNAL TYPES — Ingest API contract (mirrors shared-types but self-contained
// so the published package has zero runtime dependencies)
// ============================================================================

export type IngestFramework = 'playwright' | 'jest' | 'vitest' | 'cypress';

export interface ICiContext {
  source: 'github' | 'gitlab' | 'azure' | 'jenkins' | 'local';
  repository?: string;
  branch?: string;
  prNumber?: number;
  commitSha?: string;
  /** URL back to the originating CI job (e.g. the GitHub Actions run URL). */
  runUrl?: string;
}

/** Discriminated union of every event type the reporter can emit. */
export type IngestEvent =
  | { type: 'log'; testId?: string; chunk: string; timestamp: number }
  | { type: 'test-begin'; testId: string; title: string; file: string; timestamp: number }
  | {
    type: 'test-end'; testId: string;
    status: 'passed' | 'failed' | 'skipped' | 'timedOut';
    duration: number; error?: string; timestamp: number
  }
  | { type: 'status'; status: 'RUNNING' | 'ANALYZING'; timestamp: number };

// ============================================================================
// HTTP PAYLOAD SHAPES
// ============================================================================

export interface SetupPayload {
  projectId: string;
  runName?: string;
  framework: IngestFramework;
  reporterVersion: string;
  totalTests: number;
  environment?: 'development' | 'staging' | 'production';
  ciContext?: ICiContext;
}

export interface SetupResponseData {
  sessionId: string;
  taskId: string;
  cycleId: string;
}

export interface SetupResponse {
  success: boolean;
  data: SetupResponseData;
}

export interface EventBatch {
  sessionId: string;
  events: IngestEvent[];
}

export interface TeardownPayload {
  sessionId: string;
  status: 'PASSED' | 'FAILED';
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    /** Total run duration in milliseconds. */
    duration: number;
  };
}
