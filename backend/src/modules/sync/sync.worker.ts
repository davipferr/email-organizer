import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JobsService, QUEUES } from '../../jobs/jobs.service.js';
import { MailProviderRegistry } from '../../mail-providers/mail-provider.registry.js';
import { ProviderAuthError } from '../../mail-providers/provider-errors.js';
import type { MailProvider, ProviderAuth } from '../../mail-providers/mail-provider.js';
import { SyncStatus, SyncType } from '../../generated/prisma/enums.js';
import type { MailAccount, SyncRun } from '../../generated/prisma/client.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { MessageStoreService } from './message-store.service.js';

export interface SyncJobData {
  syncRunId: string;
}

// Runs the sync jobs queued by SyncService: fetches metadata from the provider
// in batches, stores Message/Label rows and updates the SyncRun progress.
@Injectable()
export class SyncWorker implements OnModuleInit {
  private readonly logger = new Logger(SyncWorker.name);
  // Runs in progress in this process, so the Stop button can interrupt them.
  private readonly running = new Map<string, AbortController>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly accounts: AccountsService,
    private readonly providers: MailProviderRegistry,
    private readonly store: MessageStoreService,
  ) {}

  async onModuleInit() {
    // Runs interrupted by a restart can't resume; mark them failed so Sync can be clicked again.
    await this.prisma.syncRun.updateMany({
      where: { status: SyncStatus.RUNNING },
      data: { status: SyncStatus.FAILED, error: 'Interrupted by a server restart', finishedAt: new Date() },
    });
    await this.jobs.boss.work<SyncJobData>(QUEUES.SYNC, async ([job]) => {
      await this.run(job.data.syncRunId);
    });
  }

  // Stops a run of this process. Returns false if it isn't running here (not picked up yet).
  cancel(syncRunId: string): boolean {
    const controller = this.running.get(syncRunId);
    controller?.abort(new Error('Sync stopped'));
    return !!controller;
  }

  private async run(syncRunId: string) {
    // Registered before reading the row: SyncService sets cancelRequested and then calls
    // cancel(), so a Stop either finds this controller or is seen in the row below.
    const controller = new AbortController();
    this.running.set(syncRunId, controller);
    try {
      await this.runSync(syncRunId, controller.signal);
    } finally {
      this.running.delete(syncRunId);
    }
  }

  private async runSync(syncRunId: string, signal: AbortSignal) {
    const run = await this.prisma.syncRun.findUnique({ where: { id: syncRunId }, include: { account: true } });
    if (!run || run.status !== SyncStatus.RUNNING) return;

    const { account } = run;
    try {
      if (run.cancelRequested) throw new Error('Sync stopped before it started');
      const provider = this.providers.get(account.provider);
      const auth = this.accounts.authFor(account);
      const labels = await this.store.syncLabels(account.id, await provider.listLabels(auth));

      let cursor: string;
      const changes =
        run.type === SyncType.INCREMENTAL && account.lastHistoryId
          ? await provider.incrementalSync(auth, account.lastHistoryId)
          : null;

      if (changes) {
        const total = changes.upserted.length + changes.deletedIds.length;
        await this.store.upsertMessages(account.id, changes.upserted, labels);
        await this.store.deleteMessages(account.id, changes.deletedIds);
        await this.progress(run.id, total, total);
        cursor = changes.newCursor;
      } else {
        // First sync, forced, or the incremental cursor expired.
        if (run.type !== SyncType.FULL) {
          await this.prisma.syncRun.update({ where: { id: run.id }, data: { type: SyncType.FULL } });
        }
        cursor = await this.fullSync(run, account, provider, auth, labels, signal);
      }

      await this.prisma.mailAccount.update({
        where: { id: account.id },
        data: { lastHistoryId: cursor, lastSyncedAt: new Date() },
      });
      await this.prisma.syncRun.update({
        where: { id: run.id },
        data: { status: SyncStatus.DONE, finishedAt: new Date() },
      });
    } catch (err) {
      // Batches stored so far stay; the account's cursor and lastSyncedAt are left as they were,
      // so the next Sync starts over from the last complete one.
      if (signal.aborted || run.cancelRequested) {
        this.logger.log(`Sync ${run.id} stopped by the user`);
        await this.prisma.syncRun.update({
          where: { id: run.id },
          data: { status: SyncStatus.CANCELLED, finishedAt: new Date() },
        });
        return;
      }
      this.logger.error(`Sync ${run.id} failed`, err instanceof Error ? err.stack : err);
      const error =
        err instanceof ProviderAuthError ? 'Gmail access expired. Reconnect and sync again.' : 'Sync failed. Try again.';
      await this.prisma.syncRun.update({
        where: { id: run.id },
        data: { status: SyncStatus.FAILED, error, finishedAt: new Date() },
      });
    }
  }

  private async fullSync(
    run: SyncRun,
    account: MailAccount,
    provider: MailProvider,
    auth: ProviderAuth,
    labels: Map<string, string>,
    signal: AbortSignal,
  ): Promise<string> {
    const { cursor } = await provider.fullSync(
      auth,
      async (batch, progress) => {
        await this.store.upsertMessages(account.id, batch, labels, run.id);
        await this.progress(run.id, progress.processed, progress.total);
      },
      signal,
    );
    await this.store.deleteNotSeenIn(account.id, run.id);
    return cursor;
  }

  private progress(syncRunId: string, processed: number, total: number) {
    return this.prisma.syncRun.update({ where: { id: syncRunId }, data: { processed, total } });
  }
}
