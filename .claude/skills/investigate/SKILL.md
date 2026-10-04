---
name: investigate
description: Find the real cause of a bug or answer "how does X work / why does Y happen" by reading the actual code path end to end and proving the cause with evidence, instead of guessing. Use before proposing any fix for a bug, error, wrong number, or unexpected behavior, and whenever the user asks why something happens or where something is implemented.
argument-hint: "<symptom or question>"
---

# Investigate — read the code, don't guess

The failure this skill prevents: naming a plausible cause from memory ("probably a caching
issue") without having read the code that runs. Every claim must point to code you read in
this session or to something you observed.

## 1. Pin down the symptom

Restate `$ARGUMENTS` as: **where** (page/endpoint/job), **what happens**, **what should happen**.
If you can't fill all three, look it up in `docs/feature-map.md` or ask one short question.

## 2. Trace the path end to end — read every hop

Follow the request through each layer and **open each file** (don't infer from names):

```
UI     frontend/src/pages/<Page>.tsx → features/<area>/* → api/hooks.ts → api/client.ts
HTTP   backend/src/modules/<name>/<name>.controller.ts (+ <name>.schemas.ts validation)
Logic  <name>.service.ts → AccountsService.getProviderContext()
Data   mail-providers/<gmail|fake>/*.ts   |   sync/message-store.service.ts + prisma/schema.prisma
Jobs   jobs/jobs.service.ts → *.worker.ts / bulk-actions.service.ts (background, polled by the UI)
```

Use `Grep` for the route string, query key, testid or error message to find the entry point.
Note `file:line` for every step as you go — it becomes the evidence trail.

Common splits in this codebase that explain "wrong data" bugs:
- **Live vs synced**: the mail list/drawer read the provider live; **Senders reads the synced
  copy in PostgreSQL**, updated only by Sync and `MessageStoreService.applyLabelChange`.
- **Gmail vs fake provider**: both implement `MailProvider`; a bug may exist in only one.
- **React Query cache**: stale UI after a mutation usually means a missing/incorrect
  `invalidateQueries` key (keys start with `[resource, accountId]`).

## 3. Form hypotheses, then test them

- Check recent history of the files on the path (`git log -p -5 -- <files>`). A recent change to
  the code the symptom points at is the obvious suspect: examine it and say explicitly whether
  it's the cause or why it isn't, before naming another cause.
- List 1–3 candidate causes, each tied to specific lines.
- **Prove or kill each one** with the cheapest real check:
  - reproduce on the fake mailbox (see the `verify` skill for login/reset),
  - call the endpoint from the page with `fetch('/api/...')` and read the actual response,
  - read backend logs (`preview_logs`), or query the DB shape via `schema.prisma`,
  - write a tiny Vitest case for pure logic.
- If a check contradicts your hypothesis, drop it — don't bend the evidence.

## 4. Report

```
Symptom:   <one line>
Root cause: <one or two sentences>  — <file:line>
Evidence:  <what you ran/observed that confirms it>
Path:      <the hops you read, as file:line list>
Fix:       <smallest change that addresses the cause, and where>
Unknowns:  <anything not verified, stated as such>
```

Separate **verified** facts from **inferences**. "I didn't verify X" is a fine answer;
a confident guess is not.

Don't change code in this skill unless the user asked for a fix — then hand over to the
fix with the evidence above, and finish with the `verify` skill.
