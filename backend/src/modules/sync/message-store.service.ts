import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { MailLabel, MailMessageSummary } from '../../mail-providers/mail-provider.js';

// providerLabelId → Label.id
export type LabelMap = Map<string, string>;

// Keeps the synced copy of email metadata (Message / Label / MessageLabel) up to date.
// Used by the sync worker and after actions taken in the app.
@Injectable()
export class MessageStoreService {
  constructor(private readonly prisma: PrismaService) {}

  // Mirrors the provider's labels; returns the id map for linking messages.
  async syncLabels(accountId: string, labels: MailLabel[]): Promise<LabelMap> {
    for (const l of labels) {
      const data = { name: l.name, type: l.type, colorBg: l.colorBg ?? null, colorText: l.colorText ?? null };
      await this.prisma.label.upsert({
        where: { accountId_providerLabelId: { accountId, providerLabelId: l.providerLabelId } },
        create: { accountId, providerLabelId: l.providerLabelId, ...data },
        update: data,
      });
    }
    await this.prisma.label.deleteMany({
      where: { accountId, providerLabelId: { notIn: labels.map((l) => l.providerLabelId) } },
    });
    return this.labelMap(accountId);
  }

  async labelMap(accountId: string): Promise<LabelMap> {
    const rows = await this.prisma.label.findMany({ where: { accountId }, select: { id: true, providerLabelId: true } });
    return new Map(rows.map((r) => [r.providerLabelId, r.id]));
  }

  async upsertMessages(accountId: string, messages: MailMessageSummary[], labels: LabelMap, syncRunId?: string) {
    if (!messages.length) return;
    const existing = await this.prisma.message.findMany({
      where: { accountId, providerMessageId: { in: messages.map((m) => m.providerMessageId) } },
      select: { id: true, providerMessageId: true },
    });
    const idByProvider = new Map(existing.map((e) => [e.providerMessageId, e.id]));

    const rows = messages.map((m) => {
      const id = idByProvider.get(m.providerMessageId) ?? randomUUID();
      return {
        id,
        providerMessageId: m.providerMessageId,
        isNew: !idByProvider.has(m.providerMessageId),
        data: {
          threadId: m.threadId,
          fromEmail: m.from.email,
          fromName: m.from.name ?? null,
          fromDomain: m.from.email.split('@')[1] ?? m.from.email,
          subject: m.subject ?? null,
          snippet: m.snippet ?? null,
          date: new Date(m.date),
          sizeBytes: m.sizeBytes,
          isUnread: m.isUnread,
          listUnsubscribe: m.listUnsubscribe ?? null,
          ...(syncRunId ? { syncRunId } : {}),
        },
        labelIds: m.labelIds.map((p) => labels.get(p)).filter((x): x is string => !!x),
      };
    });

    await this.prisma.$transaction(async (tx) => {
      const created = rows.filter((r) => r.isNew);
      if (created.length) {
        await tx.message.createMany({
          data: created.map((r) => ({ id: r.id, accountId, providerMessageId: r.providerMessageId, ...r.data })),
          skipDuplicates: true,
        });
      }
      for (const r of rows.filter((r) => !r.isNew)) {
        await tx.message.update({ where: { id: r.id }, data: r.data });
      }
      await tx.messageLabel.deleteMany({ where: { messageId: { in: rows.map((r) => r.id) } } });
      await tx.messageLabel.createMany({
        data: rows.flatMap((r) => r.labelIds.map((labelId) => ({ messageId: r.id, labelId }))),
        skipDuplicates: true,
      });
    }, { timeout: 60_000 });
  }

  async deleteMessages(accountId: string, providerMessageIds: string[]) {
    if (!providerMessageIds.length) return;
    await this.prisma.message.deleteMany({ where: { accountId, providerMessageId: { in: providerMessageIds } } });
  }

  // After a full sync: remove rows the provider no longer has.
  async deleteNotSeenIn(accountId: string, syncRunId: string) {
    await this.prisma.message.deleteMany({
      where: { accountId, OR: [{ syncRunId: null }, { syncRunId: { not: syncRunId } }] },
    });
  }

  // Applies an action taken in the app to the synced rows, without calling the provider.
  async applyLabelChange(accountId: string, providerMessageIds: string[], add: string[], remove: string[]) {
    if (!providerMessageIds.length) return;
    const labels = await this.labelMap(accountId);
    const messages = await this.prisma.message.findMany({
      where: { accountId, providerMessageId: { in: providerMessageIds } },
      select: { id: true },
    });
    const ids = messages.map((m) => m.id);
    if (!ids.length) return;

    const addIds = add.map((p) => labels.get(p)).filter((x): x is string => !!x);
    const removeIds = remove.map((p) => labels.get(p)).filter((x): x is string => !!x);
    await this.prisma.$transaction([
      this.prisma.messageLabel.deleteMany({ where: { messageId: { in: ids }, labelId: { in: removeIds } } }),
      this.prisma.messageLabel.createMany({
        data: ids.flatMap((messageId) => addIds.map((labelId) => ({ messageId, labelId }))),
        skipDuplicates: true,
      }),
      ...(add.includes('UNREAD') || remove.includes('UNREAD')
        ? [this.prisma.message.updateMany({ where: { id: { in: ids } }, data: { isUnread: add.includes('UNREAD') } })]
        : []),
    ]);
  }
}
