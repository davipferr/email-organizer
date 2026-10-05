import { describe, expect, it } from 'vitest';
import { untilAborted } from './async.js';

const never = () => new Promise<never>(() => undefined);

describe('untilAborted', () => {
  it('passes the result through without a signal or when not aborted', async () => {
    await expect(untilAborted(Promise.resolve(1))).resolves.toBe(1);
    await expect(untilAborted(Promise.resolve(2), new AbortController().signal)).resolves.toBe(2);
    await expect(untilAborted(Promise.reject(new Error('x')), new AbortController().signal)).rejects.toThrow('x');
  });

  it('rejects with the abort reason while the promise is still pending', async () => {
    const controller = new AbortController();
    const waiting = untilAborted(never(), controller.signal);
    const reason = new Error('stopped');
    controller.abort(reason);
    await expect(waiting).rejects.toBe(reason);
  });

  it('rejects at once when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort(new Error('stopped'));
    await expect(untilAborted(never(), controller.signal)).rejects.toThrow('stopped');
  });
});
