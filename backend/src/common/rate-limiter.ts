import { sleep } from './async.js';

// Token bucket: callers take `cost` units and wait until the bucket has them.
// Waiters are served in order, so concurrent workers share one rate.
export class RateLimiter {
  private tokens: number;
  private last = Date.now();
  private queue: Promise<void> = Promise.resolve();
  private pausedUntil = 0;

  constructor(
    private readonly perSecond: number,
    private readonly burst: number,
  ) {
    this.tokens = burst;
  }

  take(cost: number): Promise<void> {
    const turn = this.queue.then(() => this.waitFor(cost));
    this.queue = turn;
    return turn;
  }

  // Holds every caller until `ms` from now, e.g. after the server says the quota is used up.
  pause(ms: number) {
    this.pausedUntil = Math.max(this.pausedUntil, Date.now() + ms);
  }

  private async waitFor(cost: number) {
    while (this.pausedUntil > Date.now()) await sleep(this.pausedUntil - Date.now());
    this.refill();
    if (this.tokens < cost) {
      await sleep(Math.ceil(((cost - this.tokens) / this.perSecond) * 1000));
      this.refill();
    }
    this.tokens -= cost;
  }

  private refill() {
    const now = Date.now();
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.perSecond);
    this.last = now;
  }
}
