# Frontend (React + Vite)

Imports use explicit `.ts`/`.tsx` extensions. No semicolons, single quotes (match the files).
`npm run typecheck`, `npm run lint` (oxlint), `npm test` (Vitest, `*.spec.ts` next to the code).

## Layout

```
src/
  api/client.ts    the only place that calls fetch (api/apiGet/apiPost/... + ApiError, errorMessage)
  api/hooks.ts     every React Query hook (useQuery/useMutation) and its query keys
  api/types.ts     API response types — mirror the backend, keep in sync
  pages/           one component per route (registered in router.tsx)
  features/<area>/ forms, dialogs and action hooks for one area (messages, senders, tags)
  components/      shared presentational pieces (no data fetching of their own)
  layouts/         AppLayout (shell, sidebar)
  utils/           pure helpers — test them
```

## Rules

- **Data:** read with a hook from `api/hooks.ts`; add new hooks there. Query keys start with
  the resource and `accountId` (`['messages', accountId, ...]`); invalidate by that prefix
  after a mutation.
- **No `useEffect`.** Derive values during render, handle changes in the event that causes
  them, use React Query for server state and Mantine hooks (`useDebouncedValue`, etc.) for
  the rest. (A lint rule will enforce this — see `docs/ai-agent-plan.md`, Phase 3.)
- **UI:** Mantine components and theme tokens; no other UI or CSS libraries. Icons from
  `@tabler/icons-react`.
- **Feedback:** errors via `notifications.show` with `errorMessage(err)`. Email actions go
  through `features/messages/useMessageActions.tsx`, which provides the Undo notification —
  reuse it instead of calling the API directly from a page.
- **Destructive actions** (trash, delete tag) need a confirmation or an Undo.
- Render email HTML only through DOMPurify (see `MessageDrawer.tsx`).
- UI text is in English.
