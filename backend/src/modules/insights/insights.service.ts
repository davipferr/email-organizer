import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { hasLabel, notTrashOrSpam } from '../../prisma/message-filters.js';
import { AccountsService } from '../accounts/accounts.service.js';
import type { IgnoredInput, StatsInput, StorageInput } from './insights.controller.js';
import { fillSeries, lastMonths } from './insights.utils.js';

const MONTHS = 12;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]; // ISO: Monday = 1

// Same rule as the frontend's mailCategory(): Promotions wins over Social, the rest is Primary.
const CATEGORY = Prisma.sql`CASE
  WHEN ${hasLabel('CATEGORY_PROMOTIONS')} THEN 'Promotions'
  WHEN ${hasLabel('CATEGORY_SOCIAL')} THEN 'Social'
  ELSE 'Primary' END`;

interface TotalsRow {
  messages: number;
  unread: number;
  senders: number;
  sizeBytes: bigint | null;
}

interface IgnoredRow {
  key: string;
  name: string | null;
  total: number;
  unread: number;
  streak: number;
  lastRead: Date | null;
  latest: Date;
  sizeBytes: bigint;
  listUnsubscribe: string | null;
}

interface LargestRow {
  providerMessageId: string;
  threadId: string;
  fromEmail: string;
  fromName: string | null;
  subject: string | null;
  snippet: string | null;
  date: Date;
  sizeBytes: number;
  isUnread: boolean;
  listUnsubscribe: string | null;
  labelIds: string[];
}

@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountsService,
  ) {}

  // Overview of the synced mailbox. Emails in Trash/Spam are left out.
  async stats(userId: string, accountId: string, { tz }: StatsInput) {
    const account = await this.accounts.getOwnedAccount(userId, accountId);
    const where = Prisma.sql`m."accountId" = ${accountId}::uuid AND ${notTrashOrSpam}`;
    // `date` is stored as UTC without a zone; this turns it into the user's wall clock.
    const local = Prisma.sql`((m.date AT TIME ZONE 'UTC') AT TIME ZONE ${tz})`;
    const months = lastMonths(new Date(), tz, MONTHS);

    const [[totals], byMonth, byHour, byWeekday, categories, topSenders] = await Promise.all([
      this.prisma.$queryRaw<TotalsRow[]>`
        SELECT count(*)::int AS messages,
               count(*) FILTER (WHERE m."isUnread")::int AS unread,
               count(DISTINCT m."fromEmail")::int AS senders,
               sum(m."sizeBytes")::bigint AS "sizeBytes"
        FROM messages m WHERE ${where}`,
      this.prisma.$queryRaw<{ key: string; count: number }[]>`
        SELECT to_char(date_trunc('month', ${local}), 'YYYY-MM') AS key, count(*)::int AS count
        FROM messages m WHERE ${where} AND to_char(${local}, 'YYYY-MM') >= ${months[0]}
        GROUP BY 1`,
      this.prisma.$queryRaw<{ key: number; count: number }[]>`
        SELECT extract(hour FROM ${local})::int AS key, count(*)::int AS count
        FROM messages m WHERE ${where} GROUP BY 1`,
      this.prisma.$queryRaw<{ key: number; count: number }[]>`
        SELECT extract(isodow FROM ${local})::int AS key, count(*)::int AS count
        FROM messages m WHERE ${where} GROUP BY 1`,
      this.prisma.$queryRaw<{ category: string; count: number; unread: number }[]>`
        SELECT ${CATEGORY} AS category, count(*)::int AS count, count(*) FILTER (WHERE m."isUnread")::int AS unread
        FROM messages m WHERE ${where} GROUP BY 1 ORDER BY 2 DESC`,
      this.prisma.$queryRaw<{ email: string; name: string | null; count: number }[]>`
        SELECT m."fromEmail" AS email, max(m."fromName") AS name, count(*)::int AS count
        FROM messages m WHERE ${where}
        GROUP BY m."fromEmail" ORDER BY count DESC, email LIMIT 5`,
    ]);

    return {
      lastSyncedAt: account.lastSyncedAt,
      timeZone: tz,
      totals: { ...totals, sizeBytes: Number(totals.sizeBytes ?? 0) },
      byMonth: fillSeries(months, byMonth),
      byHour: fillSeries(HOURS, byHour),
      byWeekday: fillSeries(WEEKDAYS, byWeekday),
      categories,
      topSenders,
    };
  }

  // Senders whose newest `minStreak`+ emails in a row are all unread: the streak counts back
  // from the newest email to the most recent one that was read. Emails in Trash/Spam are left out.
  async ignored(userId: string, accountId: string, { minStreak, page, pageSize }: IgnoredInput) {
    const account = await this.accounts.getOwnedAccount(userId, accountId);
    const where = Prisma.sql`m."accountId" = ${accountId}::uuid AND ${notTrashOrSpam}`;
    const perSender = Prisma.sql`
      WITH ranked AS (
        SELECT m.*, row_number() OVER (PARTITION BY m."fromEmail" ORDER BY m.date DESC) AS rn
        FROM messages m WHERE ${where}
      ), per_sender AS (
        SELECT "fromEmail" AS key,
               max("fromName") AS name,
               count(*)::int AS total,
               count(*) FILTER (WHERE "isUnread")::int AS unread,
               coalesce(min(rn) FILTER (WHERE NOT "isUnread") - 1, count(*))::int AS streak,
               max(date) FILTER (WHERE NOT "isUnread") AS "lastRead",
               max(date) AS latest,
               sum("sizeBytes")::bigint AS "sizeBytes",
               (array_agg("listUnsubscribe" ORDER BY date DESC)
                  FILTER (WHERE "listUnsubscribe" IS NOT NULL))[1] AS "listUnsubscribe"
        FROM ranked GROUP BY "fromEmail"
      )`;

    const [rows, [{ count }]] = await Promise.all([
      this.prisma.$queryRaw<IgnoredRow[]>`
        ${perSender}
        SELECT * FROM per_sender WHERE streak >= ${minStreak}
        ORDER BY streak DESC, latest DESC, key
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      this.prisma.$queryRaw<{ count: number }[]>`
        ${perSender}
        SELECT count(*)::int AS count FROM per_sender WHERE streak >= ${minStreak}`,
    ]);

    return {
      lastSyncedAt: account.lastSyncedAt,
      minStreak,
      totalSenders: count,
      page,
      pageSize,
      // Same fields as a Senders row (one sender per group), so the same actions apply.
      senders: rows.map((r) => ({ ...r, senders: 1, sizeBytes: Number(r.sizeBytes) })),
    };
  }

  // The biggest emails, to free space. Emails in Trash/Spam are left out.
  async storage(userId: string, accountId: string, { page, pageSize }: StorageInput) {
    const account = await this.accounts.getOwnedAccount(userId, accountId);
    const where = Prisma.sql`m."accountId" = ${accountId}::uuid AND ${notTrashOrSpam}`;

    const [[totals], rows] = await Promise.all([
      this.prisma.$queryRaw<{ messages: number; sizeBytes: bigint | null }[]>`
        SELECT count(*)::int AS messages, sum(m."sizeBytes")::bigint AS "sizeBytes"
        FROM messages m WHERE ${where}`,
      this.prisma.$queryRaw<LargestRow[]>`
        SELECT m."providerMessageId", m."threadId", m."fromEmail", m."fromName", m.subject, m.snippet,
               m.date, m."sizeBytes", m."isUnread", m."listUnsubscribe",
               coalesce(array_agg(l."providerLabelId") FILTER (WHERE l.id IS NOT NULL), '{}') AS "labelIds"
        FROM messages m
        LEFT JOIN message_labels ml ON ml."messageId" = m.id
        LEFT JOIN labels l ON l.id = ml."labelId"
        WHERE ${where}
        GROUP BY m.id
        ORDER BY m."sizeBytes" DESC, m.date DESC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    ]);

    return {
      lastSyncedAt: account.lastSyncedAt,
      totalMessages: totals.messages,
      totalBytes: Number(totals.sizeBytes ?? 0),
      page,
      pageSize,
      // Same shape as the live message list, so the UI can reuse its components.
      messages: rows.map(({ fromEmail, fromName, subject, snippet, date, listUnsubscribe, ...r }) => ({
        ...r,
        from: { email: fromEmail, ...(fromName ? { name: fromName } : {}) },
        subject: subject ?? undefined,
        snippet: snippet ?? undefined,
        date: date.toISOString(),
        listUnsubscribe: listUnsubscribe ?? undefined,
      })),
    };
  }
}
