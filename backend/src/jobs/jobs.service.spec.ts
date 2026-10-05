import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../config/config.module.js';
import { JobsService, QUEUES } from './jobs.service.js';

// The real module validates the environment as soon as it's imported.
vi.mock('../config/config.module.js', () => ({ AppConfig: class {} }));

function serviceWithFakeBoss() {
  const config = { get: () => 'postgres://user:pass@localhost:5433/db' } as unknown as AppConfig;
  const service = new JobsService(config);
  const boss = {
    start: vi.fn(async () => undefined),
    createQueue: vi.fn(async () => undefined),
    updateQueue: vi.fn(async () => undefined),
  };
  Object.assign(service, { boss });
  return { service, boss };
}

describe('JobsService', () => {
  // pg-boss's createQueue is "insert, do nothing on conflict": a queue created earlier keeps
  // its old settings (2 retries, 15 min expiry), so a slow sync was re-run on top of itself.
  it('applies the queue options to queues that already exist', async () => {
    const { service, boss } = serviceWithFakeBoss();
    await service.onModuleInit();

    for (const queue of Object.values(QUEUES)) {
      expect(boss.updateQueue).toHaveBeenCalledWith(queue, expect.objectContaining({ retryLimit: 0, expireInSeconds: 6 * 3600 }));
    }
  });
});
