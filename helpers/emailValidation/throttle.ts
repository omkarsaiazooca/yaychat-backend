/**
 * Per-domain SMTP throttling. Limits how many concurrent SMTP connections are
 * open to any single domain, and enforces a minimum delay between successive
 * connections to that same domain — regardless of overall worker concurrency.
 *
 * This is the main defense against our sending IP getting flagged/blocklisted
 * when probing thousands of addresses at a handful of big providers (Gmail,
 * Outlook, etc.). Ported from the reference DomainThrottler.
 */

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface DomainState {
  /** Slots currently available for concurrent connections. */
  available: number;
  /** FIFO queue of resolvers waiting for a slot. */
  waiters: Array<() => void>;
  /** Timestamp (ms) of the last connection start to this domain. */
  lastCall: number;
}

export class DomainThrottler {
  private readonly maxConcurrent: number;
  private readonly minDelayMs: number;
  private readonly domains = new Map<string, DomainState>();

  constructor(maxConcurrent = 2, minDelayMs = 1000) {
    this.maxConcurrent = Math.max(1, maxConcurrent);
    this.minDelayMs = Math.max(0, minDelayMs);
  }

  private stateFor(domain: string): DomainState {
    let s = this.domains.get(domain);
    if (!s) {
      s = { available: this.maxConcurrent, waiters: [], lastCall: 0 };
      this.domains.set(domain, s);
    }
    return s;
  }

  /**
   * Acquire a slot for `domain`, run `fn`, and release the slot afterwards.
   * Enforces both the concurrency cap and the inter-connection delay.
   */
  async run<T>(domain: string, fn: () => Promise<T>): Promise<T> {
    const key = domain.toLowerCase();
    const state = this.stateFor(key);

    // Acquire a concurrency slot (semaphore).
    if (state.available > 0) {
      state.available -= 1;
    } else {
      await new Promise<void>((resolve) => state.waiters.push(resolve));
    }

    try {
      const wait = this.minDelayMs - (Date.now() - state.lastCall);
      if (wait > 0) await sleep(wait);
      return await fn();
    } finally {
      state.lastCall = Date.now();
      const next = state.waiters.shift();
      if (next) next();
      else state.available += 1;
    }
  }
}
