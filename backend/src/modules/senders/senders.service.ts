import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
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
      Prisma.sql`NOT EXISTS (
        SELECT 1 FROM message_labels ml JOIN labels l ON l.id = ml."labelId"
        WHERE ml."messageId" = m.id AND l."providerLabelId" IN ('TRASH', 'SPAM'))`,
    ];
    if (search) {
      const like = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      conditions.push(Prisma.sql`(m."fromEmail" ILIKE ${like} OR m."fromName" ILIKE ${like})`);
    }
    if (query.labelId) {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM message_labels ml JOIN labels l ON l.id = ml."labelId"
        WHERE ml."messageId" = m.id AND l."providerLabelId" = ${query.labelId})`);
    }
    const where = Prisma.join(conditions, ' AND ');

    const [rows, [{ count }]] = await Promise.all([
      this.prisma.$queryRaw<SenderRow[]>`
        SELECT ${groupBy} AS key,
               max(m."fromName") AS name,
               count(DISTINCT m."fromEmail")::int AS senders,
               count(*)::int AS total,
               count(*) FILTER (WHERE m."isUnread")::int AS unread,
               max(m.date) AS latest,
               sum(m."sizeBytes")::bigint AS "sizeBytes"
        FROM messages m
        WHERE ${where}
        GROUP BY ${groupBy}
        ORDER BY ${ORDER[query.sort]}, key
        LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
      this.prisma.$queryRaw<{ count: number }[]>`
        SELECT count(DISTINCT ${groupBy})::int AS count FROM messages m WHERE ${where}`,
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
