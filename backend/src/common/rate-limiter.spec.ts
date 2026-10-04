import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapLimit } from './async.js';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('lets a burst through, then waits for the bucket to refill', async () => {
    const limiter = new RateLimiter(10, 10);
    const done: number[] = [];
    for (let i = 0; i < 3; i++) void limiter.take(5).then(() => done.push(i));

    await vi.advanceTimersByTimeAsync(0);
    expect(done).toEqual([0, 1]);
    await vi.advanceTimersByTimeAsync(499);
    expect(done).toEqual([0, 1]);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toEqual([0, 1, 2]);
  });

  it('holds every caller during a pause, and a shorter pause does not cut it short', async () => {
    const limiter = new RateLimiter(100, 100);
    limiter.pause(10_000);
    limiter.pause(1_000);
    let done = 0;
    for (let i = 0; i < 3; i++) void limiter.take(1).then(() => done++);

    await vi.advanceTimersByTimeAsync(9_999);
    expect(done).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(3);
  });

  it('keeps concurrent workers under the per-minute budget', async () => {
    const limiter = new RateLimiter(200, 200);
    let units = 0;
    const work = mapLimit(Array.from({ length: 3_000 }, (_, i) => i), 8, async () => {
      await limiter.take(5);
      units += 5;
      await new Promise((resolve) => setTimeout(resolve, 20)); // a fast Gmail response
    });

    await vi.advanceTimersByTimeAsync(60_000);
    // Gmail's limit is 15,000 units per user per minute.
    expect(units).toBeLessThanOrEqual(200 + 200 * 60);
    expect(units).toBeGreaterThan(11_000);
    await vi.advanceTimersByTimeAsync(60_000);
    await work;
    expect(units).toBe(15_000);
  });
});
