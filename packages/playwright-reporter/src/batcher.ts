/**
 * EventBatcher — queues IngestEvents and flushes them in two scenarios:
 *   1. Time-based: after `flushIntervalMs` milliseconds (default 2s).
 *   2. Size-based: when the queue reaches `maxBatchSize` events (default 50).
 *
 * The `drain()` method is called by the reporter's `onEnd` hook to guarantee
 * that all buffered events are sent before teardown is posted.
 *
 * All flush errors are silently swallowed — the batcher MUST NOT crash the
 * caller's test suite.
 */

import type { IngestEvent } from './types.js';

interface BatcherConfig {
  flushIntervalMs: number;
  maxBatchSize: number;
  onFlush: (events: IngestEvent[]) => Promise<void>;
}

export class EventBatcher {
  private queue: IngestEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  private readonly flushIntervalMs: number;
  private readonly maxBatchSize: number;
  private readonly onFlush: (events: IngestEvent[]) => Promise<void>;

  constructor(config: BatcherConfig) {
    this.flushIntervalMs = config.flushIntervalMs;
    this.maxBatchSize = config.maxBatchSize;
    this.onFlush = config.onFlush;
  }

  push(event: IngestEvent): void {
    this.queue.push(event);

    // Arm the timer on the first event in a new batch.
    if (this.timer === null) {
      this.timer = setTimeout(() => {
        void this.flush();
      }, this.flushIntervalMs);
    }

    // Size-triggered flush — fire immediately, don't wait for the timer.
    if (this.queue.length >= this.maxBatchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.queue.length === 0) return;

    // Drain atomically so concurrent size + timer triggers don't double-send.
    const batch = this.queue.splice(0);
    await this.onFlush(batch).catch(() => {}); // swallow — Do No Harm
  }

  /** Flush any remaining events. Called by onEnd before teardown. */
  async drain(): Promise<void> {
    await this.flush();
  }
}
