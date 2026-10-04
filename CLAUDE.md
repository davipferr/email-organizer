# Mail organizer

Personal site to organize a Gmail inbox: browse, trash, tag, move, search, group by
sender. Designed so Outlook/IMAP can be added later without touching controllers,
database or frontend. See `README.md` for setup and deploy.

- `backend/` — NestJS + Prisma (PostgreSQL) + pg-boss. Rules in `backend/CLAUDE.md`.
- `frontend/` — React + Vite + Mantine + TanStack Query. Rules in `frontend/CLAUDE.md`.
- `docs/ai-agent-plan.md` — the plan for agent tooling (skills, hooks, verification).

## Commands (from the repo root)

| Command | What |
|---|---|
| `npm run check` | Typecheck + lint + tests for both packages. **Must pass before you say you're done.** |
| `npm test` | Vitest, both packages |
| `docker compose -f docker-compose.dev.yml up -d` | Dev PostgreSQL on `localhost:5433` |
| `npm --prefix backend run db:push` | Apply `schema.prisma` to the database |

Dev servers are defined in `.claude/launch.json` (`backend` on :3000, `frontend` on
:5173). Start them with the preview tools, never with Bash.

## Non-negotiables

- **No migrations.** Tables live only in `backend/prisma/schema.prisma`; apply with
  `db:push`. Never pass `--accept-data-loss`; if `db push` refuses, stop and tell the user.
- **Never permanently delete email.** Only move to Trash (with Undo). No "delete forever".
- **Sync is manual** (the Sync button). Don't add background/automatic sync.
- **Provider-agnostic.** Business code talks to `MailProvider` via `MailProviderRegistry`,
  never to Gmail/`googleapis` directly.
- **Never read or edit `.env`.** Use `.env.example` to learn variable names.
- **Never act on the user's real mailbox** to test something.

## Working style

- Read the real code path before explaining a bug or proposing a fix. Cite `file:line`.
  Don't guess.
- Follow the existing pattern of the nearest similar feature instead of inventing a new one.
- Comments explain *why*, never history ("changed X to Y", "previously…", "fixed bug").
- Add a Vitest `*.spec.ts` next to any pure logic you add or change.
- Keep changes scoped to the request; mention unrelated problems instead of fixing them.

## Definition of done

1. `npm run check` passes.
2. For UI or API changes: run the app and confirm the change works in the browser pane.
   (Login currently requires real Google OAuth — until the fake provider / dev-login
   from Phase 1 exists, say clearly that the browser check was not possible.)
