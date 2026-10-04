# Mail organizer

Personal site to organize a Gmail inbox: browse, trash, tag, move, search, group by
sender. Designed so Outlook/IMAP can be added later without touching controllers,
database or frontend. See `README.md` for setup and deploy.

- `backend/` — NestJS + Prisma (PostgreSQL) + pg-boss. Rules in `backend/CLAUDE.md`.
- `frontend/` — React + Vite + Mantine + TanStack Query. Rules in `frontend/CLAUDE.md`.
- `docs/feature-map.md` — how to reach and check every feature in the browser.
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
- **Never act on the user's real mailbox** to test something. Use the fake mailbox:
  `DEV_LOGIN=true` + http://localhost:5173/api/auth/dev-login?reset=1 (see `docs/feature-map.md`).

## Guardrails (enforced — don't work around them)

| Where | What it does |
|---|---|
| `.claude/hooks/guard-commands.mjs` (before Bash/PowerShell) | Blocks reading/editing `.env`, `db push --accept-data-loss`, `prisma migrate`, deleting Docker volumes, force-push, `--no-verify`; asks before `git reset --hard` / `clean -f` |
| `.claude/hooks/check-edited.mjs` (after Edit/Write) | Lints the edited file and typechecks its package; problems come back to you immediately |
| `.claude/hooks/stop-check.mjs` (before you finish) | Runs `npm run check` if code changed; you can't finish while it fails |
| `.githooks/pre-commit` | `npm run check` before every commit (`npm run hooks:install` once per clone) |
| Lint (`oxlint --deny-warnings`) | Warnings fail. Frontend: no effects, no `fetch` outside `api/client.ts`. Backend: business code can't import a specific provider or `googleapis` |

If a guardrail blocks something you believe is right, stop and explain it to the user —
never bypass it (no `--no-verify`, no lint-disable comments, no moving code to dodge a rule).

## Skills (`.claude/skills/`)

| Skill | Use it when |
|---|---|
| `/verify [area]` | After any UI/API change, before saying it's done |
| `/investigate <symptom>` | Before proposing a cause or fix for any bug or "why does…" question |
| `/repro-bug <report>` | A bug is reported — reproduce on the fake mailbox before fixing |
| `/add-feature <description>` | Building or extending a feature, layer by layer |

## Working style

- Read the real code path before explaining a bug or proposing a fix. Cite `file:line`.
  Don't guess.
- Follow the existing pattern of the nearest similar feature instead of inventing a new one.
- Comments explain *why*, never history ("changed X to Y", "previously…", "fixed bug").
- Add a Vitest `*.spec.ts` next to any pure logic you add or change.
- Keep changes scoped to the request; mention unrelated problems instead of fixing them.

## Definition of done

1. `npm run check` passes.
2. For UI or API changes: run the `verify` skill (dev login with reset, the feature-map checks
   for the changed area, console/backend errors, screenshot). If you couldn't, say so — never
   claim it works untested.
3. New UI controls get a `data-testid`; update `docs/feature-map.md` when a feature changes.
