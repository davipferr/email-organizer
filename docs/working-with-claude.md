# Working with Claude on this project

How to use the harness from `docs/ai-agent-plan.md` day to day. The goal from the talk: stop
being the bottleneck by trusting a system of checks, not by reading every line.

## One task, one session

| Task size | How |
|---|---|
| Small (copy change, one-line fix) | Main checkout, just ask. Hooks and the Stop check catch the basics. |
| Anything touching 3+ files, the schema or a provider | Start in **plan mode**, agree on the plan, then let it run. |
| Several tasks at once | One session **per worktree** (desktop app: new session → worktree; CLI: `claude --worktree`), each on its own app slot (below). |

Name the skill in the prompt when it matters: "/repro-bug the archive undo doesn't…",
"/add-feature a Spam action…", "/investigate why…". Skills are what make the work repeatable.

## Parallel app instances (slots)

Each checkout that needs the running app takes a slot. `scripts/dev.mjs` gives every slot its
own ports, database (`mail_organizer_slotN`, created on first start) and session cookie, and
reads the main checkout's `.env` — worktrees never get a copy.

| Slot | Backend | Frontend | Launch configs | Wait for it |
|---|---|---|---|---|
| 0 (main checkout) | :3000 | :5173 | `backend`, `frontend` | `node .claude/skills/verify/wait-for-app.mjs 90 0` |
| 1 | :3100 | :5273 | `backend-1`, `frontend-1` | `… wait-for-app.mjs 90 1` |
| 2 | :3200 | :5373 | `backend-2`, `frontend-2` | `… wait-for-app.mjs 90 2` |

Dev login per slot: `http://localhost:<frontend port>/api/auth/dev-login?reset=1`.
Tell a worktree session which slot is its own ("use slot 1").

## Reviewing what Claude did

1. The report: what changed, checks ✅/❌, the `/verify` screenshot, what wasn't verified.
2. `/code-review` on the branch (or the diff) — a second pass for bugs the checks can't see.
3. Skim the diff for *shape* (right files, right layer), not for typos — lint, types, tests
   and the pre-commit hook already cover those.
4. Merge. The pre-commit hook runs `npm run check` once more.

## The feedback rule

When you catch yourself writing the **same review comment twice**, turn it into a check
instead of repeating it — in this order of preference:

1. **Lint rule** (oxlint config) or a **type** — fails instantly, everywhere.
2. **Hook** (`.claude/hooks/`) — for commands or workflow, not code shape.
3. **Skill line** (`.claude/skills/*/SKILL.md`) or `CLAUDE.md` — for judgment calls; then add an
   eval case (`evals/`) that would catch the mistake, and run `/run-evals` for that skill.

## Trust curve for this project

| Level | You do | Claude does |
|---|---|---|
| 1 — now | Plan mode for big work, read reports, review diffs | Implements, verifies in the browser, runs checks |
| 2 — parallel | Run 2–3 worktree sessions on separate slots, review at the end | Same, isolated per slot |
| 3 — with CI (later) | Review PRs that already passed CI + `/code-review` | Opens PRs; CI runs `npm run check` (same as the pre-commit hook) |

Move up a level when the evals stay ≥ 8/10 and you stop finding issues the checks missed.
