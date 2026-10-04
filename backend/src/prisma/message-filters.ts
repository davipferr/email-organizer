import { Prisma } from '../generated/prisma/client.js';

// Raw-SQL conditions over the synced `messages` table, aliased as `m`.

// Emails in Trash or Spam don't count as part of the mailbox (Gmail leaves them out too).
export const notTrashOrSpam = Prisma.sql`NOT EXISTS (
  SELECT 1 FROM message_labels ml JOIN labels l ON l.id = ml."labelId"
  WHERE ml."messageId" = m.id AND l."providerLabelId" IN ('TRASH', 'SPAM'))`;

export const hasLabel = (providerLabelId: string) => Prisma.sql`EXISTS (
  SELECT 1 FROM message_labels ml JOIN labels l ON l.id = ml."labelId"
  WHERE ml."messageId" = m.id AND l."providerLabelId" = ${providerLabelId})`;
