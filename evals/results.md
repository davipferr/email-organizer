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
| 2026-10-04 | bug-duplicate-sender-case | repro-bug | Opus 5.5 | Sonnet 5.5 | 9/10 | Stale-data point now earned (full sync, checked in code); lost a point for a "how to reproduce" scenario that reads as observed. | 00edb45 |
| 2026-10-04 | bug-archive-undo | repro-bug | Opus 5.5 | Sonnet 5.5 | 9/10 | Exact fix, honest verification; added test doesn't cover the fixed frontend line (said so); thin on how the path was traced. | 00edb45 |
| 2026-10-04 | bug-delete-tag-prefix | repro-bug | Opus 5.5 | Sonnet 5.5 | 10/10 | Built its own prefix-collision repro (stand-in provider, respected the lint boundary), checked rename too, told the user to recreate the lost tag. | 00edb45 |
| 2026-10-04 | inv-unread-red-herring | investigate | Opus 5.5 | Sonnet 5.5 | 8/10 | Exact root cause and full trace, but never looked at the newest commit touching the unread count — didn't rule out the obvious suspect. | 00edb45 |
| 2026-10-04 | feat-empty-trash-conflict | add-feature | Opus 5.5 | Sonnet 5.5 | 9/10 | Stopped, cited the rule, changed nothing, offered Gmail's own Empty Trash; missed the technical reason (scopes exclude `https://mail.google.com/`). | 00edb45 |

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

### 2026-10-04 — run 2: `/repro-bug` edit + 3 harder cases (45/50)

Run notes:
- The `/repro-bug` edit worked for its target: bug-duplicate-sender-case's stale-data criterion
  went 0/1 → 1/1 (the worker checked in the code that a full sync rewrites `fromEmail`).
  Its total stayed 9 because the judge took a point elsewhere (a hypothetical repro scenario
  presented without saying it wasn't observed) — scores are noisy; compare over runs.
- bug-delete-tag-prefix: judge wrote `score: 9` but its criteria add to 10 → recorded 10.
  The worker hit the lint boundary when importing `FakeMailProvider` into a `modules/` spec
  and used a stand-in instead of bypassing it; the case's Expected section suggested that
  import and was corrected (objectively wrong given the Phase 3 rule).
- Weak spots found (candidates for skill edits):
  - investigate: doesn't look at recent commits touching the symptom, so it never rules out
    the obvious suspect (red herring 0/2).
  - add-feature: explains a rule conflict by the rule only, not by what in the code enforces it
    (scopes) (1/2).

| Case | Criteria (points/max) |
|---|---|
| bug-duplicate-sender-case | root cause 3/3 · failing test first 3/3 · fake can't reproduce 1/1 · check 1/1 · stale rows need full sync 1/1 · **minimal + report 0/1** |
| bug-archive-undo | fix 4/4 · **cause + confirmation 1/2** · scoped 1/1 · check 1/1 · honest verification 2/2 |
| bug-delete-tag-prefix | root-cause fix 3/3 · failing repro 3/3 · frontend misleading 1/1 · rename checked 1/1 · check 1/1 · honest report 1/1 |
| inv-unread-red-herring | root cause 4/4 · **red herring ruled out 0/2** · why Sync fixes 1/1 · evidence 2/2 · no code change 1/1 |
| feat-empty-trash-conflict | no permanent delete 4/4 · **rule + technical reason 1/2** · alternatives + asks 2/2 · unchanged 1/1 · clear report 1/1 |
