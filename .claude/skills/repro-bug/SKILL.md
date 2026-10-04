---
name: repro-bug
description: Turn a bug report (even a vague one — a sentence, a screenshot, "the count is wrong") into a confirmed reproduction on the fake mailbox, fix the root cause, and prove the fix. Use when the user reports a bug, says something is broken or wrong, or pastes an error or screenshot from the app.
argument-hint: "<bug report>"
---

# Reproduce → fix → prove

Rule: **no fix before a reproduction.** A fix for a bug you never saw is a guess.

## 1. Translate the report into steps

From `$ARGUMENTS` (and any screenshot), identify the feature and write numbered user steps
plus the expected vs actual result, using `docs/feature-map.md` for routes and test ids.
Vague report → choose the most likely reading, state it, and go; ask only if two readings
lead to different code.

## 2. Reproduce on the fake mailbox

Start and log in exactly as in the `verify` skill (servers, `wait-for-app.mjs`,
`/api/auth/dev-login?reset=1`). Run the steps and record what you observe with the probe.

- **Reproduced** → note the exact steps and observed values. Go to 3.
- **Not reproduced** → don't stop at "works for me". Check, in order:
  1. Does the fixture lack the data shape? (e.g. thousands of emails, a sender with no name,
     a label with special characters). If so, reproduce with a Vitest case against
     `createFakeMailbox()`/the service, or extend the fixtures in
     `backend/src/mail-providers/fake/fake-mailbox.ts` (keep them deterministic).
  2. Is it Gmail-specific? Compare `gmail/gmail.provider.ts` with `fake/fake.provider.ts` for
     that operation. If the fake behaves differently from Gmail, that difference is a bug in the
     fake too — fix the fake so it can reproduce, then fix the real code.
  3. Is it state-dependent? (synced vs not synced, after a bulk job, after Undo, after a
     backend restart reset the mailbox).
  If still not reproducible, report what you tried and ask the user for the missing detail.

## 3. Find the cause

Use the `investigate` skill: trace the code path, cite `file:line`, prove the cause.

## 4. Lock it with a test (when the cause is in logic)

Write a failing Vitest case first (`*.spec.ts` next to the code) — run it and see it fail
for the right reason. UI-only bugs (layout, a missing invalidate) can rely on step 6 instead.

## 5. Fix the cause, not the symptom

Smallest change at the root. No defensive patches in unrelated layers, no "just in case" code.
If the same bug can happen in the other provider, fix both.

## 6. Prove it

- The new test passes; `npm run check` passes.
- Re-run the **exact** reproduction steps from step 2 on a fresh reset → the bug is gone.
- Run the `verify` skill's error checks and take a screenshot.

## Report

Steps to reproduce · root cause (`file:line`) · fix · test added · verification result.
