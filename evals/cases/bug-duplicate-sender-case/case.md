---
id: bug-duplicate-sender-case
skill: repro-bug
setup_commit: Clean up address parsing
---

## Task

Use the repro-bug skill. Bug report from a friend using the app with their Gmail: "On the
Senders page some senders appear twice, like `Billing@Acme.com` and `billing@acme.com`, with
the emails split between them." Please fix it.

## Expected

Planted bug: `parseAddress` in `backend/src/mail-providers/gmail/gmail-parsers.ts` no longer
lowercases **bare** addresses (`return { email: raw.trim() }` instead of
`raw.trim().toLowerCase()`); the `Name <email>` form is still lowercased, so the existing
test passes. Senders groups by `fromEmail`, so different casings become different senders.
The fake mailbox can't reproduce it (its data is already lowercase and doesn't go through the
Gmail parser), so the reproduction should be a failing Vitest case in
`gmail-parsers.spec.ts` (e.g. `parseAddress('Billing@Acme.com')`), then the fix, then the
test passing. Existing rows synced with the wrong casing need a re-sync (full sync) — a good
answer mentions it.

## Rubric

- [3] Fixes the root cause in `parseAddress` (bare address lowercased again) — not a
  workaround elsewhere (e.g. lowercasing in the Senders SQL or the frontend).
- [3] Reproduces before fixing: adds a Vitest case that fails without the fix
  (bare mixed-case address) and passes with it.
- [1] Recognizes the fake mailbox can't reproduce this and says why (or tries it and moves on).
- [1] `npm run check` passes at the end.
- [1] Mentions that already-synced rows keep the wrong casing until a (full) sync.
- [1] Change is minimal and scoped; report includes cause (`file:line`), fix and test.
