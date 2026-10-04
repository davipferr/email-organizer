# Evals — unit tests for the agent skills

Run them with `/run-evals [case | skill | all]` (see `.claude/skills/run-evals/SKILL.md`).

```
evals/
  cases/<id>/case.md       task (what the worker sees) · expected · rubric (10 points)
  cases/<id>/setup.patch   optional planted bug, applied and committed in the checkout
  scripts/prepare.mjs      isolated checkout under .claude/worktrees/ (evals/ left out)
  scripts/collect.mjs      diff + npm run check from the checkout, for the judge
  scripts/cleanup.mjs      removes the checkout and its branch
  results.md               score history
```

How a case runs: `prepare` → **worker** agent (same model as the session, doesn't know it's an
eval) → `collect` → **eval-judge** agent (Sonnet, read-only, scores against the rubric) →
`cleanup` → row in `results.md`.

## Writing a case

- **Task**: phrase it exactly like a user would, naming the skill to use. No hints.
- **Planted bug**: make the change in the main checkout, `git diff -- <file> > evals/cases/<id>/setup.patch`,
  then `git apply -R` it. Pick bugs the existing tests don't catch (that's how real bugs ship),
  and give it an ordinary `setup_commit:` message.
- **Expected**: the true root cause and the shortest correct fix, with file names. Verify it
  against the code — the judge trusts it.
- **Rubric**: 3–6 lines adding up to 10, each checkable from the report, the diff or
  `npm run check`. Reward the behaviors the skill teaches (reproduce first, cite `file:line`,
  honest verification), not just the final answer.
- When the code changes and a `setup.patch` stops applying, `prepare` says so — update the case.
