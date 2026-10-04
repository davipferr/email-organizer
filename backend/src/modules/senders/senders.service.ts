import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { hasLabel, notTrashOrSpam } from '../../prisma/message-filters.js';
import { AccountsService } from '../accounts/accounts.service.js';
import type { ListSendersInput } from './senders.controller.js';

interface SenderRow {
  key: string;
  name: string | null;
  senders: number;
  total: number;
  unread: number;
  latest: Date;
  sizeBytes: bigint;
  listUnsubscribe: string | null;
}

const GROUP_COLUMN = { email: Prisma.raw('m."fromEmail"'), domain: Prisma.raw('m."fromDomain"') };
const ORDER = {
  count: Prisma.raw('total DESC'),
  latest: Prisma.raw('latest DESC'),
  size: Prisma.raw('"sizeBytes" DESC'),
};

@Injectable()
export class SendersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountsService,
  ) {}

  // Groups the synced metadata by sender email or domain. Emails in Trash/Spam are left out.
  async list(userId: string, accountId: string, query: ListSendersInput) {
    const account = await this.accounts.getOwnedAccount(userId, accountId);
    const groupBy = GROUP_COLUMN[query.groupBy];
    const search = query.search?.trim();

    const conditions = [
      Prisma.sql`m."accountId" = ${accountId}::uuid`,
      notTrashOrSpam,
    ];
    if (search) {
      const like = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      conditions.push(Prisma.sql`(m."fromEmail" ILIKE ${like} OR m."fromName" ILIKE ${like})`);
    }
    if (query.labelId) {
      conditions.push(hasLabel(query.labelId));
    }
    const where = Prisma.join(conditions, ' AND ');
    // On the group, not the rows, so the counts still cover every email from the sender.
    const having = query.unsubscribable
      ? Prisma.sql`HAVING bool_or(m."listUnsubscribe" IS NOT NULL)`
      : Prisma.empty;

    const [rows, [{ count }]] = await Promise.all([
      this.prisma.$queryRaw<SenderRow[]>`
        SELECT ${groupBy} AS key,
               max(m."fromName") AS name,
               count(DISTINCT m."fromEmail")::int AS senders,
               count(*)::int AS total,
               count(*) FILTER (WHERE m."isUnread")::int AS unread,
               max(m.date) AS latest,
               sum(m."sizeBytes")::bigint AS "sizeBytes",
               -- The newest header wins: senders change their unsubscribe links over time.
               (array_agg(m."listUnsubscribe" ORDER BY m.date DESC)
                  FILTER (WHERE m."listUnsubscribe" IS NOT NULL))[1] AS "listUnsubscribe"
        FROM messages m
        WHERE ${where}
        GROUP BY ${groupBy}
        ${having}
        ORDER BY ${ORDER[query.sort]}, key
        LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
      this.prisma.$queryRaw<{ count: number }[]>`
        SELECT count(*)::int AS count
        FROM (SELECT 1 FROM messages m WHERE ${where} GROUP BY ${groupBy} ${having}) g`,
    ]);

    return {
      lastSyncedAt: account.lastSyncedAt,
      totalGroups: count,
      page: query.page,
      pageSize: query.pageSize,
      senders: rows.map((r) => ({ ...r, sizeBytes: Number(r.sizeBytes) })),
    };
  }
}
