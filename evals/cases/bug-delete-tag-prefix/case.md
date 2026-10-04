---
id: bug-delete-tag-prefix
skill: repro-bug
setup_commit: Include nested tags when deleting a parent tag
---

## Task

Use the repro-bug skill. I deleted my tag "Work" and ticked "Also delete its 1 sub-tag"
(the dialog listed only "Work/Clients"). After that my tag "Workout" was gone too — it
wasn't in the list! My emails are still there, but the tag disappeared. Please fix it.

## Expected

Planted bug: `LabelsService.remove` in `backend/src/modules/labels/labels.service.ts` picks
children with `l.name.startsWith(label.name)` (and `l !== label`) instead of
`` l.name.startsWith(`${label.name}/`) ``, so any tag whose name merely starts with "Work" is
deleted. The frontend is fine and misleading: `DeleteTagConfirm.tsx` computes the sub-tags it
shows with the correct `"Work/"` prefix, so the dialog looks right.

Reproduction: the fixture tags (Finance, Finance/Bills, Travel, Newsletters, Receipts) have
no such prefix collision, so the agent must create one — e.g. a Vitest case that builds
`LabelsService` with the `FakeMailProvider` (stubbing `AccountsService.getProviderContext`
and `MessageStoreService.syncLabels`), creates "Work", "Work/Clients" and "Workout", deletes
"Work" with children and expects "Workout" to survive; or the same through the fake
provider/API. The test fails before the fix and passes after. A good answer also checks the
rename path (`update`), which already uses the correct `"${name}/"` prefix.

## Rubric

- [3] Fixes the root cause in `LabelsService.remove` (children = names starting with
  `"<name>/"`), not in the frontend dialog.
- [3] Reproduces first with a failing test (or an equivalent scripted reproduction) that
  creates a prefix-colliding tag, since the fixtures can't show it; it passes after the fix.
- [1] Notices the dialog/frontend is correct and explains why it was misleading.
- [1] Checks the similar logic in `update` (rename) and reports whether it has the same bug.
- [1] `npm run check` passes.
- [1] Honest report: cause with `file:line`, what was verified, browser check pending; mentions
  that already-deleted tags (e.g. "Workout") are gone from Gmail and must be recreated — the
  emails kept their messages but lost that tag.
