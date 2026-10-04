import { z } from 'zod';

// Emails selected in the list (immediate actions).
const idsSelector = z.object({ ids: z.array(z.string()).min(1).max(1000) });

// Every email from a sender (or domain) / matching a search (background bulk actions).
const bulkSelector = z.union([z.object({ from: z.string().min(3) }), z.object({ q: z.string().min(1) })]);

export const listMessagesSchema = z.object({
  q: z.string().optional(),
  labelId: z.string().optional(),
  pageToken: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const trashSchema = z.object({ selector: idsSelector });

export const labelsChangeSchema = z.object({
  selector: idsSelector,
  add: z.array(z.string()).default([]),
  remove: z.array(z.string()).default([]),
});

export const moveSchema = z.object({
  selector: idsSelector,
  to: z.string(),
  from: z.string().default('INBOX'),
});

export const bulkSchema = z.object({
  selector: bulkSelector,
  action: z.discriminatedUnion('type', [
    z.object({ type: z.literal('trash') }),
    z.object({
      type: z.literal('labels'),
      add: z.array(z.string()).default([]),
      remove: z.array(z.string()).default([]),
    }),
  ]),
});

export type ListMessagesInput = z.infer<typeof listMessagesSchema>;
export type TrashInput = z.infer<typeof trashSchema>;
export type LabelsChangeInput = z.infer<typeof labelsChangeSchema>;
export type MoveInput = z.infer<typeof moveSchema>;
export type BulkInput = z.infer<typeof bulkSchema>;
