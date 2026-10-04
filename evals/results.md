# Eval results

Score = sum of the judge's per-criterion points (not the judge's own total).

## Runs

| Date | Case | Skill | Worker | Judge | Score | Judge summary | HEAD |
|---|---|---|---|---|---|---|---|
| 2026-10-04 | inv-senders-count-trash | investigate | Opus 5.5 | Sonnet 5.5 | 10/10 | Found the dropped `'TRASH'` at `senders.service.ts:41` and the commit that dropped it; full path traced; inferences labelled. | 563ef20 |
| 2026-10-04 | inv-outside-changes | investigate | Opus 5.5 | Sonnet 5.5 | 10/10 | Both answers with line-level citations; caught the 30 s `staleTime` subtlety and labelled it as inference. | 563ef20 |
| 2026-10-04 | bug-duplicate-sender-case | repro-bug | Opus 5.5 | Sonnet 5.5 | 9/10 | Failing test first, one-line root-cause fix; hedged instead of saying plainly that existing rows need a full sync. | 563ef20 |
| 2026-10-04 | bug-archive-undo | repro-bug | Opus 5.5 | Sonnet 5.5 | 10/10 | Exact fix with `file:line`, regression test, honest that the browser check wasn't done. | 563ef20 |
| 2026-10-04 | feat-mark-spam | add-feature | Opus 5.5 | Sonnet 5.5 | 10/10 | Shortest path (reused labels endpoint), test id, feature map, honest report; added a small extra helper for a smarter Undo. | 563ef20 |

## Details

### 2026-10-04 — baseline (first run)

Run notes:
- Agents `worker` / `eval-judge` were created in the same session, so this run used the
  general-purpose agent with the same instructions (judge model: Sonnet).
- feat-mark-spam: the judge wrote `score: 9` but its criteria add to 10 → recorded 10, and
  `/run-evals` now computes the score from the criteria.
- feat-mark-spam: the worker briefly wrote `check.log` outside its checkout (then deleted it
  and reported it) → `worker.md` now says temp files go inside the checkout.

| Case | Criteria (points/max) |
|---|---|
| inv-senders-count-trash | root cause 4/4 · why trash keeps count 2/2 · why Sync doesn't help 1/1 · evidence 2/2 · no code change 1/1 |
| inv-outside-changes | applyLabelChange 3/3 · reads synced rows 1/1 · manual Sync only 3/3 · incremental + fallback 2/2 · grounded claims 1/1 |
| bug-duplicate-sender-case | root-cause fix 3/3 · failing test first 3/3 · fake can't reproduce 1/1 · check 1/1 · **stale rows need full sync 0/1** · minimal + report 1/1 |
| bug-archive-undo | fix 4/4 · cause + confirmation 2/2 · scoped 1/1 · check 1/1 · honest verification 2/2 |
| feat-mark-spam | perform + undo, no backend 3/3 · button + testid + done 2/2 · rules 1/1 · feature map 1/1 · check 2/2 · honest 1/1 |
