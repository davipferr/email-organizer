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

- [ ] `FakeMailProvider` implementing `MailProvider`, backed by JSON fixtures in
      `backend/fixtures/` (~200 emails, bulk senders, labels, unread); `FAKE` added to
      `MailProviderType`
- [ ] Dev-only login `POST /api/auth/dev-login` (only when `NODE_ENV !== 'production'`
      and `DEV_LOGIN=true`; startup fails if enabled in production)
- [ ] `npm run seed:dev` — resets the fake account to a known state
- [ ] `docs/feature-map.md` — per feature: route, how to reach it, `data-testid`s,
      expected result, API endpoints
- [ ] Stable `data-testid`s on the main interactive elements
- [ ] Remove the direct `GmailProvider` import from `auth.service.ts` (go through the registry)

## Phase 2 — Skills

- [ ] `/verify` — start servers, seed, dev-login, walk the feature map for the changed
      area, check console/network, screenshot, `npm run check`
- [ ] `/investigate` — read the real code path before proposing causes; cite `file:line`
- [ ] `/repro-bug` — reproduce on fake data first, then fix, then `/verify`
- [ ] `/add-feature` — schema → module → hook → feature component → page → feature map
- [ ] `/add-provider` (later) — checklist for Outlook/IMAP using the fake provider as reference

## Phase 3 — Hard guardrails

- [ ] `.claude/settings.json` permissions: deny `.env` access, `db push --accept-data-loss`,
      `docker compose down -v`, `git push --force`; allow common safe commands
- [ ] Claude hooks (Node scripts, Windows-safe): `PostToolUse` fast typecheck/lint of the
      touched package; `Stop` runs `npm run check`; `PreToolUse` blocks destructive commands
- [ ] Lint: ban `useEffect` (refactor the 2 uses in `SendersPage.tsx`); `fetch` only in
      `frontend/src/api/`
- [ ] Backend boundary rule: `modules/**` may not import `mail-providers/gmail/**`
- [ ] Git pre-commit hook running `npm run check`

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
