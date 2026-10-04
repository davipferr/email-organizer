---
name: run-evals
description: Run the agent evals in evals/cases — each case in an isolated checkout with a disguised planted bug, solved by a worker agent and scored 0–10 by a judge on a different model — and record the scores in evals/results.md. Use when the user asks to run evals, test or benchmark the skills, or after changing a skill to see if it got better.
argument-hint: "[case id | skill name | all]"
disable-model-invocation: true
---

# Run the skill evals

Evals are unit tests for the skills. A case = a task as a user would phrase it, an optional
planted bug, the expected outcome and a 10-point rubric (`evals/cases/<id>/case.md`).

## 1. Pick cases

`$ARGUMENTS`: a case id, a skill name (matches `skill:` in the case front matter), or empty /
`all`. List them first with their skill so the user sees what will run.

The checkout is created from **HEAD**: commit (or stash) the skill change you want to measure
first, or you'll be measuring the old version.

## 2. Run every case (in parallel)

For each case:

1. `node evals/scripts/prepare.mjs <id>` → JSON `{dir, base, branch}`. If it says the setup
   patch no longer applies, report it and skip the case (the case needs updating).
2. Spawn the **`worker`** agent in the background with exactly this prompt, nothing more:

   ```
   Checkout: <dir>

   <the case's "## Task" section, verbatim>
   ```

   Never pass the Expected or Rubric sections, never mention evals, scores, judges or planted
   bugs — agents behave differently when they know they're being tested.

Start all workers before waiting on any of them.

## 3. Judge each finished case

When a worker finishes:

1. `node evals/scripts/collect.mjs <dir> <base>` → changed files, diff, `npm run check` result.
2. Spawn the **`eval-judge`** agent (it runs on a different model than the worker) with:
   the checkout path, the case's Task, Expected and Rubric sections, the worker's final report
   (verbatim), and the collect JSON. It answers with JSON `{score, criteria, summary}`.
   **The case score is the sum of `criteria[].points`** — judges sometimes misadd their own
   total; if it disagrees with `score`, use the sum and note it in the details.
   Save the collect JSON to a file in your scratchpad and give the judge the path instead of
   pasting a large diff.
3. `node evals/scripts/cleanup.mjs <dir> <branch>` — always, even if the worker or judge failed.

## 4. Record

Append to `evals/results.md`:
- one row per case in the **Runs** table: date, case, skill, worker model, judge model, score,
  the judge's summary (one line), and the git short SHA of HEAD;
- under **Details**, a short block per case with the per-criterion points.

Then show the user a table of this run's scores next to the previous score per case.

## 5. Improve a skill (hill climbing)

For a case below 8/10:
- Read the judge's per-criterion evidence and the worker's report. Find the *instruction* in
  the skill that was missing or unclear — not the symptom.
- Propose the smallest edit to `.claude/skills/<skill>/SKILL.md`; after the user agrees,
  apply it, commit, and re-run only that skill's cases.
- Scores are noisy: compare versions over 2–3 runs, not one.
- Never edit a case's Expected or Rubric to raise a score. Only fix a case when it's
  objectively wrong (and say so in the commit).

To repeat automatically while iterating: `/loop /run-evals <skill>`.

## Limits

Workers can't use the running app (its ports belong to the main checkout), so cases are about
code reading, tests and `npm run check`; the browser part of `verify` isn't evaluated yet.
