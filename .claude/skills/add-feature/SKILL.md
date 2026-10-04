---
name: add-feature
description: Build a new feature or extend an existing one end to end (database → provider → backend module → API hooks → UI → feature map → tests → browser verification) following this project's patterns. Use when the user asks to add, build, implement or create a feature, page, endpoint, action, button or setting.
argument-hint: "<feature description>"
---

# Add a feature the project's way

The shortest path here is the right path: copy the nearest existing feature's shape and go
layer by layer. Skip layers the feature doesn't need, never reorder them.

## 0. Plan (short)

- Restate `$ARGUMENTS` as user-visible behavior + acceptance checks (these become the
  `verify` checks later).
- Check it against the non-negotiables in `CLAUDE.md` (no permanent delete, manual sync,
  provider-agnostic, no migrations). If it conflicts, stop and ask.
- Pick the **template feature** to copy:

| New feature looks like… | Copy from |
|---|---|
| CRUD on a provider resource | tags: `modules/labels/*`, `features/tags/*`, `pages/TagsPage.tsx` |
| Action on selected emails (with Undo) | `messages.controller.ts` trash/untrash + `features/messages/useMessageActions.tsx` |
| Action on *all* emails of a sender/search | `bulk-actions.service.ts` (pg-boss job) + `features/messages/runBulkAction.tsx` |
| Aggregation over synced data | `modules/senders/*` + `pages/SendersPage.tsx` |
| Long-running import | `modules/sync/*` (SyncRun row + polling) |

- Non-trivial (new table, new provider method, 3+ layers)? Present the plan and wait for an OK.

## 1. Database — `backend/prisma/schema.prisma` (if needed)

Additive only (new optional fields / new tables). Then `npm --prefix backend run db:push` and
`npm --prefix backend run prisma:generate`. If `db push` refuses, stop and tell the user —
never `--accept-data-loss`. Email bodies are never stored.

## 2. Provider — `backend/src/mail-providers/` (if it talks to the mailbox)

Add the method to `MailProvider` in `mail-provider.ts`, then implement it in **both**
`gmail/gmail.provider.ts` and `fake/fake.provider.ts` (faithful to Gmail's behavior), with a
test in `fake/fake.provider.spec.ts`. Pure parsing → a `*.spec.ts` beside it.
Gmail-only code (`googleapis`) stays inside `gmail/`.

## 3. Backend module — `backend/src/modules/<name>/`

- Controller: `@UseGuards(SessionGuard)`, routes under `accounts/:accountId/...`,
  `@CurrentUserId()`, every body/query through `ZodValidationPipe`. Thin.
- Service: `accounts.getProviderContext(userId, accountId)` (checks ownership), then provider
  call, then keep the synced copy right (`MessageStoreService`) if emails changed.
- Work over many emails → a pg-boss job returning a row the UI polls.
- New module → register it in `app.module.ts`. New env var → `config/env.ts` **and** `.env.example`.

## 4. API layer — `frontend/src/api/`

Response types in `types.ts` (mirror the backend). A hook in `hooks.ts`: query key
`['<resource>', accountId, ...]`; mutations invalidate by that prefix on success.

## 5. UI — `frontend/src/features/<area>/` and `pages/`

- Mantine only; no `useEffect` (derive in render, handle in events, React Query for server state).
- Email actions go through `useMessageActions` (Undo included). Destructive → confirm or Undo.
- Errors → `notifications.show({ color: 'red', message: errorMessage(err) })`.
- **Every new interactive control gets a `data-testid`** (kebab-case, `<area>-<thing>`).
- New page → route in `router.tsx` (inside `AppLayout`) and a link in `SidebarNav.tsx`.

## 6. Feature map — `docs/feature-map.md`

Add/update the section: route, how to reach it, test ids, expected results, API endpoints,
and the fixture facts a check can rely on. If the fixtures can't show the feature, extend
`fake-mailbox.ts` (deterministic) and update its table.

## 7. Prove it

`npm run check`, then the `verify` skill with the acceptance checks from step 0.
Report: what was built (per layer), checks ✅/❌, screenshot.
