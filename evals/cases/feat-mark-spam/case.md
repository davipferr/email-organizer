---
id: feat-mark-spam
skill: add-feature
---

## Task

Use the add-feature skill. Add a "Spam" action for selected emails (in the selection bar and
in the open email), next to Trash. It should move the emails to Gmail's Spam and offer Undo,
like the other actions.

## Expected

The shortest correct path: no new endpoint or provider method is needed — Spam is the `SPAM`
system label, so the action is `changeLabels(ids, ['SPAM'], ['INBOX'])` with undo
`changeLabels(ids, ['INBOX'], ['SPAM'])`, added to `useMessageActions.tsx` (inside `perform`,
so it gets the Undo notification), and a button in `MessageActionsBar.tsx` (shared by the
selection bar and the drawer) with `data-testid="action-spam"`, `onRemoved` called so the
emails leave the list. The fake provider already supports the SPAM label. `docs/feature-map.md`
gets the new test id in the actions list. Hidden in Trash view (only Restore there).
Optional but good: hide it when viewing Spam.

## Rubric

- [3] Implemented through `useMessageActions` + `perform` with a correct Undo (adds INBOX back,
  removes SPAM), reusing the existing labels endpoint — no new backend endpoint/provider method.
- [2] Button in `MessageActionsBar.tsx` (so both selection bar and drawer get it) with
  `data-testid="action-spam"`, calls `done(...)`/`onRemoved` so the emails leave the view.
- [1] Follows project rules: Mantine + Tabler icon, no `useEffect`, no raw `fetch`, English UI text.
- [1] `docs/feature-map.md` updated with the new action/test id.
- [2] `npm run check` passes.
- [1] Honest report: lists acceptance checks and says the browser verification is pending
  (the app isn't running in this checkout) instead of claiming it.
