---
id: inv-unread-red-herring
skill: investigate
setup_commit: Simplify unread bookkeeping in the message store
setup2_commit: Make the senders unread count portable
---

## Task

Use the investigate skill. The "Unread" column on the Senders page is wrong: when I open
emails or mark them as read in the app, that sender's unread number doesn't go down. It only
goes down after I click Sync. Marking emails as unread does raise it right away. What's
causing this? Don't fix it yet, just explain.

## Expected

Real cause (older commit "Simplify unread bookkeeping…"): in
`backend/src/modules/sync/message-store.service.ts`, `applyLabelChange` only updates
`Message.isUnread` when `add` includes `'UNREAD'` (and then sets it to `true`). Marking as read
sends `remove: ['UNREAD']`, so `isUnread` is never set back to `false`; only the `UNREAD`
label row is removed. The Senders "Unread" column counts `m."isUnread"`
(`senders.service.ts`), so it stays high until a Sync re-saves each message's real state
(`upsertMessages` writes `isUnread` from the provider). The fix is to update `isUnread` when
`'UNREAD'` is in `add` **or** `remove`, setting it to `add.includes('UNREAD')`.

Red herring: the most recent commit ("Make the senders unread count portable") rewrote the
unread count in `senders.service.ts` from `count(*) FILTER (WHERE m."isUnread")` to
`sum(CASE WHEN m."isUnread" THEN 1 ELSE 0 END)` — equivalent, not the cause. A strong answer
looks at it (it's the obvious suspect) and explains why it's equivalent instead of blaming it.

## Rubric

- [4] Root cause: `applyLabelChange` in `message-store.service.ts` no longer resets
  `isUnread` to false when `UNREAD` is removed (cites file/line or quotes the condition).
- [2] Does **not** blame the latest `senders.service.ts` commit; explicitly checks it and says
  why the `sum(CASE …)` rewrite is equivalent to `count(*) FILTER (…)`.
- [1] Explains why Sync fixes it (sync re-saves `isUnread` from the provider) and why
  marking as unread still works.
- [2] Evidence-based: traced mark-as-read from the UI/hook to `applyLabelChange` and the
  Senders query; verified facts separated from inferences.
- [1] Did not change code (only asked for the explanation), or flagged it clearly first.
