import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JobsService, QUEUES } from '../../jobs/jobs.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { SyncStatus, SyncType } from '../../generated/prisma/enums.js';
import type { SyncJobData } from './sync.worker.js';

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly accounts: AccountsService,
  ) {}

  // The Sync button: FULL the first time (or when forced), INCREMENTAL afterwards.
  async start(userId: string, accountId: string, forceFull: boolean) {
    const account = await this.accounts.getOwnedAccount(userId, accountId);
    const running = await this.prisma.syncRun.findFirst({ where: { accountId, status: SyncStatus.RUNNING } });
    if (running) throw new ConflictException('A sync is already running');

    const run = await this.prisma.syncRun.create({
      data: {
        accountId,
        type: forceFull || !account.lastHistoryId ? SyncType.FULL : SyncType.INCREMENTAL,
      },
    });
    await this.jobs.boss.send(QUEUES.SYNC, { syncRunId: run.id } satisfies SyncJobData);
    return run;
  }

  async status(userId: string, accountId: string) {
    const account = await this.accounts.getOwnedAccount(userId, accountId);
    const [run, messageCount] = await Promise.all([
      this.prisma.syncRun.findFirst({ where: { accountId }, orderBy: { startedAt: 'desc' } }),
      this.prisma.message.count({ where: { accountId } }),
    ]);
    return { lastSyncedAt: account.lastSyncedAt, messageCount, run };
  }
}
