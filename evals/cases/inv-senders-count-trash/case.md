---
id: inv-senders-count-trash
skill: investigate
setup_commit: Simplify sender grouping query
---

## Task

Use the investigate skill. On the Senders page, the email counts look too high: after I
trash every email from a sender in the app, that sender still shows the same number of
emails, even after I click Sync. Why? Don't fix it, just tell me the cause.

## Expected

Planted bug: in `backend/src/modules/senders/senders.service.ts`, the condition that excludes
Trash/Spam from the grouping only lists `'SPAM'` — `'TRASH'` was dropped
(`... l."providerLabelId" IN ('SPAM')`). Trashing keeps the synced rows (it only adds the
TRASH label via `MessageStoreService.applyLabelChange`), so the grouping still counts them.
Sync doesn't help: trashed messages still exist in the provider and are re-synced with the
TRASH label. The fix is to exclude `'TRASH'` again (`IN ('TRASH', 'SPAM')`).

## Rubric

- [4] Names the root cause precisely: the Trash exclusion in `senders.service.ts`'s
  query is missing `'TRASH'` (cites the file, ideally the line).
- [2] Explains why trashing doesn't change the count: trash only adds a TRASH label to the
  synced row (`applyLabelChange` / `MessageStoreService`), rows aren't deleted.
- [1] Explains why Sync doesn't fix it (trashed emails are still synced, with the TRASH label).
- [2] Evidence-based: traced the real path (page → hook → controller → service) and/or checked
  history (`git log -p`), and separates verified facts from inferences; no invented causes
  (caching, frontend bugs) stated as fact.
- [1] Did not change code (the user asked only for the cause), or changed it only after
  explicitly flagging it.
