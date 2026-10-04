# AI agent development plan (Claude Code)

Based on Lauren Tan's talk on building trust in coding agents, adapted from Cursor to
Claude Code. Local only — cloud agents and CI/CD are out of scope for now (when CI
exists, `npm run check` and the pre-commit hook move into it unchanged).

The core idea: instead of reviewing every line an agent writes, build a harness where
the agent can **verify its own work** and where bad code **fails mechanically**.

## Decisions

| Decision | Choice |
|---|---|
| How the agent tests without real mail | **Fake mail provider** with JSON fixtures + dev-only login |
| `useEffect` in React | **Banned** (lint error) |
| Local quality gate | **Git pre-commit hook** running `npm run check`, plus Claude hooks |
| Comments | Allowed when they explain *why*; no history/changelog comments |

## Cursor → Claude Code

| Talk concept | Here |
|---|---|
| Rules / context | `CLAUDE.md` (root) + `backend/CLAUDE.md` + `frontend/CLAUDE.md` |
| Pstack skills | `.claude/skills/<name>/SKILL.md` (run as `/name`) |
| Control Glass | Claude's built-in browser pane + `.claude/launch.json` |
| Feature maps | `docs/feature-map.md` |
| Evals + judge | Subagents in `.claude/agents/` + `/loop` |
| Strict CI | Claude hooks, permission deny rules, lint rules, pre-commit hook |
| Parallel agents | Git worktrees |

---

## Phase 0 — Foundation

- [x] Root `CLAUDE.md`: stack, commands, non-negotiables, definition of done
- [x] `backend/CLAUDE.md` and `frontend/CLAUDE.md`: layering and conventions
- [x] Root `package.json` with `npm run check` (typecheck + lint + tests, both packages)
- [x] Vitest for pure logic (`gmail-parsers.ts`, `utils/format.ts`)

## Phase 1 — Verification (unlocks everything else)

- [x] `FakeMailProvider` (`backend/src/mail-providers/fake/`): in-memory mailbox generated from
      a fixed seed (~200 emails, bulk senders, tags, unread, Trash, Spam, Sent); `FAKE` added to
      `MailProviderType`
- [x] Dev-only login `GET /api/auth/dev-login` (needs `DEV_LOGIN=true`; startup fails if enabled
      in production) + "Dev login" button on `/login` in dev builds
- [x] Reset to a known state: `?reset=1` on the dev login (replaces the planned `seed:dev`
      script — the mailbox lives in the backend's memory, so a script couldn't reset it)
- [x] `docs/feature-map.md` — per feature: route, how to reach it, `data-testid`s,
      expected result, API endpoints
- [x] Stable `data-testid`s on the main interactive elements
- [x] `auth.service.ts` goes through `MailProviderRegistry` instead of importing `GmailProvider`

## Phase 2 — Skills

- [x] `/verify` — start servers (`wait-for-app.mjs` instead of sleeps), dev-login with reset,
      feature-map checks, console/log errors with a baseline, screenshot, `npm run check`;
      includes the traps found while dogfooding it (6 s Undo, iframe delay, drawer animation)
- [x] `/investigate` — read the real code path before proposing causes; cite `file:line`
- [x] `/repro-bug` — reproduce on fake data first (extend fixtures if needed), test, fix, `/verify`
- [x] `/add-feature` — template table + schema → provider (both) → module → hook → UI →
      feature map → `/verify`
- [ ] `/add-provider` (later) — checklist for Outlook/IMAP using the fake provider as reference

## Phase 3 — Hard guardrails

- [x] `.claude/settings.json` permissions: deny Read/Edit of `.env`; allow the common safe
      commands (check, typecheck, lint, tests, git status/diff/log)
- [x] Claude hooks (Node scripts in `.claude/hooks/`, Windows-safe):
      - `PreToolUse` guard: deny `.env`, `db push --accept-data-loss/--force-reset`,
        `prisma migrate`, Docker volume deletion, force-push, `--no-verify`; ask before
        `git reset --hard`/`clean -f`/`checkout --`. 23 regression tests in `npm test`.
      - `PostToolUse`: lint the edited file + typecheck its package (~3–6 s), errors fed back
      - `Stop`: `npm run check` when code changed (cached per working-tree fingerprint);
        blocks once, then tells the user instead of looping
- [x] Lint: `--deny-warnings` in both packages; frontend bans `useEffect`/`useLayoutEffect`
      (+ `React.` forms and Mantine's effect hooks) and `fetch` outside `api/client.ts`;
      the 2 effects in `SendersPage.tsx` refactored to events/query keys; last warning fixed
- [x] Backend lint (oxlint added) with the boundary rule: business code can't import
      `googleapis` or a specific provider. Dev login moved to `dev-login.service.ts`, the one
      documented exception
- [x] Git pre-commit hook (`.githooks/pre-commit`, `npm run hooks:install`)

## Phase 4 — Evals

- [ ] `evals/<skill>/cases/*.md` — tasks with known answers (planted bugs, "where is X")
- [ ] Subagents: `skill-runner` (isolated worktree) and `judge` (different model, 0–10 rubric)
- [ ] `/run-evals` skill writing `evals/results.md`
- [ ] Hill-climb skills with `/loop /run-evals`

## Phase 5 — Working mode

- [ ] Configurable ports / dev DB so several worktrees can run the app at once
- [ ] Habit: plan mode for non-trivial work; `/code-review` before merging
- [ ] Rule: a review comment given twice becomes a lint rule, hook or skill line —
      in that order of preference
