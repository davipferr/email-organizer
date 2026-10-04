---
id: inv-outside-changes
skill: investigate
---

## Task

Use the investigate skill. Two questions about the Senders page:
1. When I tag or trash emails inside the app, the Senders numbers update without me
   clicking Sync. How does that work?
2. If I delete or tag emails directly in Gmail's own website, when (if ever) do the
   Senders numbers reflect that?

## Expected

1. Actions in the app go through `MessagesService` (and `BulkActionsService` for bulk jobs),
   which call the provider and then `MessageStoreService.applyLabelChange`, updating the
   synced `Message`/`MessageLabel` rows in PostgreSQL directly — the Senders query reads
   those rows (`senders.service.ts`). On the frontend, bulk actions invalidate
   `['senders', accountId]` (`runBulkAction.tsx`); single actions (`useMessageActions`) only
   invalidate messages, so the Senders page picks up the new numbers when its query is
   refetched (on mount once older than the 30 s `staleTime` in `main.tsx`) — a subtle point;
   noticing it is a plus, not required.
2. Changes made outside the app only show after the user clicks **Sync**: sync is manual
   (no background job). Sync is incremental when a cursor exists — Gmail's history API from
   `lastHistoryId` (`gmail.provider.ts` `incrementalSync`), falling back to a full sync if the
   cursor expired (~1 week of history) — and the worker (`sync.worker.ts`) upserts changed
   rows and deletes removed ones.

## Rubric

- [3] Q1: identifies `MessageStoreService.applyLabelChange` called after provider actions in
  `messages.service.ts` / `bulk-actions.service.ts`, with file references.
- [1] Q1: notes the Senders view reads synced rows from PostgreSQL (`senders.service.ts`),
  not the live provider.
- [3] Q2: states clearly that outside changes appear only after a manual Sync (no automatic
  sync), citing the sync controller/service/worker.
- [2] Q2: explains incremental sync via the history cursor (`lastHistoryId`,
  `incrementalSync`) and the full-sync fallback when it expires.
- [1] Every claim is tied to code that was actually read; no speculation stated as fact.
