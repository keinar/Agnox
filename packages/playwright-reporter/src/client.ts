/**
 * AgnoxClient — thin fetch wrapper for the Ingest API.
 *
 * Golden rule: NEVER throw. Every method catches all errors and returns null
 * on failure so the reporter can silently degrade without affecting the user's
 * test suite.
 */

import type {
  AgnoxReporterConfig,
  EventBatch,
  SetupPayload,
  SetupResponse,
  TeardownPayload,
} from './types.js';

const REQUEST_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 1_000;

export class AgnoxClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly debug: boolean;

  constructor(config: Pick<AgnoxReporterConfig, 'baseUrl' | 'apiKey' | 'debug'>) {
    this.baseUrl = (config.baseUrl ?? 'https://app.agnox.io').replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
    };
    this.debug = config.debug ?? false;
  }

  async setup(payload: SetupPayload): Promise<SetupResponse | null> {
    return this.post<SetupResponse>('/api/ingest/setup', payload);
  }

  async sendEvents(batch: EventBatch): Promise<void> {
    await this.post<unknown>('/api/ingest/event', batch);
  }

  async teardown(payload: TeardownPayload): Promise<void> {
    await this.post<unknown>('/api/ingest/teardown', payload);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async post<T>(path: string, body: unknown, attempt = 1): Promise<T | null> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
        // AbortSignal.timeout is available in Node 18+ with native fetch
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!res.ok) {
        this.log(`[agnox] HTTP ${res.status} on ${path}`);
        return null;
      }

      return res.json() as T;
    } catch (err: unknown) {
      // Retry once on transient network errors (NOT on 4xx / 5xx — those are
      // caught by the !res.ok branch above and don't throw).
      if (attempt < 2) {
        await new Promise<void>(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        return this.post<T>(path, body, attempt + 1);
      }

      this.log(`[agnox] Failed to reach Agnox (${path}): ${String(err)}`);
      return null; // Graceful degradation — never re-throws
    }
  }

  private log(msg: string): void {
    if (this.debug) process.stderr.write(msg + '\n');
  }
}
