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

- [x] `evals/cases/<id>/case.md` (+ `setup.patch` planted bug): 5 cases — 2 investigate,
      2 repro-bug, 1 add-feature. Planted bugs pass the existing tests, like real escaped bugs
- [x] Isolation + disguise: `evals/scripts/prepare.mjs` makes a git worktree under
      `.claude/worktrees/wt-<random>`, hides `evals/` (sparse checkout), commits the planted bug
      with an ordinary message; `collect.mjs` (diff + `npm run check`), `cleanup.mjs`
- [x] Agents: `worker` (session model, doesn't know it's an eval) and `eval-judge`
      (Sonnet, read-only, strict JSON score against the rubric)
- [x] `/run-evals` skill writing `evals/results.md`, with hill-climbing rules
      (`/loop /run-evals <skill>`; never edit a rubric to raise a score)
- [x] First baseline run recorded in `evals/results.md`
- [ ] Browser-based evals for `verify` — needs per-worktree ports (Phase 5)
- [x] `/repro-bug`: one line about repairing data a bug already stored — its target criterion
      went 0/1 → 1/1 in run 2
- [x] 3 harder cases (misleading recent commit, misleading frontend over a backend bug, a
      request that breaks a non-negotiable); `prepare.mjs` supports several planted commits.
      Run 2: 45/50 (see `evals/results.md`)
- [x] `/investigate`: check recent commits touching the symptom and rule out the obvious suspect
      explicitly (red herring scored 0/2) — applied, not re-measured yet
- [x] `/add-feature`: when a request conflicts with a rule, name what in the code enforces it
      (e.g. OAuth scopes) and offer an alternative (1/2) — applied, not re-measured yet
- [x] Lint: `*.spec.ts` may import the fake provider anywhere (still not `googleapis` or the real
      Gmail provider)
- [ ] Next eval run: `/run-evals investigate` and `/run-evals add-feature` to measure the two edits

## Phase 5 — Working mode

- [x] App slots (`scripts/dev.mjs`, launch configs `backend-N`/`frontend-N`): per-slot ports,
      database (`mail_organizer_slotN`, auto-created) and session cookie; worktrees read the
      main checkout's env file (`ENV_FILE`), never a copy. Verified two slots side by side:
      separate accounts, mailboxes and logins
- [x] `worktree.symlinkDirectories` links `node_modules` into Claude-created worktrees
- [x] `/verify`, feature map, CLAUDE.md and README are slot-aware
- [x] Habits in `docs/working-with-claude.md`: plan mode for non-trivial work, one task per
      worktree session, `/code-review` before merging, trust-curve levels
- [x] Rule: a review comment given twice becomes a lint rule, hook or skill line (+ eval case) —
      in that order of preference
- [ ] Later: browser-based evals for `verify` (a slot per eval worker)
