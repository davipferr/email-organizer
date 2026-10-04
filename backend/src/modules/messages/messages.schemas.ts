import { z } from 'zod';

// Which emails an action applies to: selected ids, everyone from a sender, or a search.
export const selectorSchema = z.union([
  z.object({ ids: z.array(z.string()).min(1).max(5000) }),
  z.object({ from: z.email() }),
  z.object({ q: z.string().min(1) }),
]);

export const listMessagesSchema = z.object({
  q: z.string().optional(),
  labelId: z.string().optional(),
  pageToken: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const trashSchema = z.object({ selector: selectorSchema });

export const labelsChangeSchema = z.object({
  selector: selectorSchema,
  add: z.array(z.string()).default([]),
  remove: z.array(z.string()).default([]),
});

export const moveSchema = z.object({
  selector: selectorSchema,
  to: z.string(),
  from: z.string().default('INBOX'),
});

export type ListMessagesInput = z.infer<typeof listMessagesSchema>;
export type TrashInput = z.infer<typeof trashSchema>;
export type LabelsChangeInput = z.infer<typeof labelsChangeSchema>;
export type MoveInput = z.infer<typeof moveSchema>;
