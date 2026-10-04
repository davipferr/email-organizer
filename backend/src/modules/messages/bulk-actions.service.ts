import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JobsService, QUEUES } from '../../jobs/jobs.service.js';
import { MailProviderRegistry } from '../../mail-providers/mail-provider.registry.js';
import { ProviderAuthError } from '../../mail-providers/provider-errors.js';
import type { MessageSelector } from '../../mail-providers/mail-provider.js';
import { BulkActionType, SyncStatus } from '../../generated/prisma/enums.js';
import { chunk } from '../../common/async.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { MessageStoreService } from '../sync/message-store.service.js';
import type { BulkInput } from './messages.schemas.js';

interface BulkJobData {
  bulkActionId: string;
}

const CHUNK = 500;

// Actions on every email from a sender or matching a search. They can touch thousands
// of emails, so they run as pg-boss jobs and report progress.
@Injectable()
export class BulkActionsService implements OnModuleInit {
  private readonly logger = new Logger(BulkActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly accounts: AccountsService,
    private readonly providers: MailProviderRegistry,
    private readonly store: MessageStoreService,
  ) {}

  async onModuleInit() {
    await this.prisma.bulkAction.updateMany({
      where: { status: SyncStatus.RUNNING },
      data: { status: SyncStatus.FAILED, error: 'Interrupted by a server restart', finishedAt: new Date() },
    });
    await this.jobs.boss.work<BulkJobData>(QUEUES.BULK_ACTION, async ([job]) => {
      await this.run(job.data.bulkActionId);
    });
  }

  async start(userId: string, accountId: string, input: BulkInput) {
    await this.accounts.getOwnedAccount(userId, accountId);
    const bulk = await this.prisma.bulkAction.create({
      data: {
        accountId,
        type: input.action.type === 'trash' ? BulkActionType.TRASH : BulkActionType.MODIFY_LABELS,
        selector: input.selector,
        addLabelIds: input.action.type === 'labels' ? input.action.add : [],
        removeLabelIds: input.action.type === 'labels' ? input.action.remove : [],
      },
    });
    await this.jobs.boss.send(QUEUES.BULK_ACTION, { bulkActionId: bulk.id } satisfies BulkJobData);
    return bulk;
  }

  async status(userId: string, accountId: string, bulkActionId: string) {
    await this.accounts.getOwnedAccount(userId, accountId);
    const bulk = await this.prisma.bulkAction.findUnique({ where: { id: bulkActionId } });
    if (!bulk || bulk.accountId !== accountId) throw new NotFoundException();
    return bulk;
  }

  private async run(bulkActionId: string) {
    const bulk = await this.prisma.bulkAction.findUnique({ where: { id: bulkActionId }, include: { account: true } });
    if (!bulk || bulk.status !== SyncStatus.RUNNING) return;

    const { account } = bulk;
    try {
      const provider = this.providers.get(account.provider);
      const auth = this.accounts.authFor(account);
      const ids = await provider.resolveSelector(auth, bulk.selector as MessageSelector);
      await this.prisma.bulkAction.update({ where: { id: bulk.id }, data: { total: ids.length } });

      let processed = 0;
      for (const part of chunk(ids, CHUNK)) {
        if (bulk.type === BulkActionType.TRASH) {
          await provider.trash(auth, part);
          await this.store.applyLabelChange(account.id, part, ['TRASH'], []);
        } else {
          await provider.modifyLabels(auth, part, bulk.addLabelIds, bulk.removeLabelIds);
          await this.store.applyLabelChange(account.id, part, bulk.addLabelIds, bulk.removeLabelIds);
        }
        processed += part.length;
        await this.prisma.bulkAction.update({ where: { id: bulk.id }, data: { processed } });
      }

      await this.prisma.bulkAction.update({
        where: { id: bulk.id },
        data: { status: SyncStatus.DONE, finishedAt: new Date() },
      });
    } catch (err) {
      this.logger.error(`Bulk action ${bulk.id} failed`, err instanceof Error ? err.stack : err);
      await this.prisma.bulkAction.update({
        where: { id: bulk.id },
        data: {
          status: SyncStatus.FAILED,
          error: err instanceof ProviderAuthError ? 'Gmail access expired. Reconnect and try again.' : 'Action failed. Try again.',
          finishedAt: new Date(),
        },
      });
    }
  }
}
