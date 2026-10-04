---
name: verify
description: Verify a change works in the running app — start the servers, log in with the fake mailbox, exercise the changed feature in the browser pane, check console and server logs, screenshot as proof, and run npm run check. Use after any UI or API change before saying it is done, or when the user asks to verify, test, check, or prove a change works. Pass a feature or area name to focus on it.
argument-hint: "[feature or area, e.g. 'trash undo' or 'senders']"
---

# Verify a change in the running app

Goal: evidence that the change works for a real user, not just that it compiles.
Never test with Google login or a real mailbox — only the fake mailbox.

## 1. Decide what to check

- Area: `$ARGUMENTS` if given; otherwise derive it from `git diff --stat` and `git status`.
- Open `docs/feature-map.md` and read the section(s) for that area. Write down 2–5 concrete
  checks *before* clicking anything: the changed behavior itself, plus the most likely thing
  it could have broken nearby (e.g. a change to trash → also check Undo and the Trash folder).
- Backend-only change with no UI? Still verify through the UI or via `fetch('/api/...')`
  from the page (the session cookie is sent automatically).

## 2. Start the app

1. `npm run check` first — no point clicking through a build that doesn't typecheck.
2. `preview_start` with `name: "backend"` and `name: "frontend"` (reuses running servers).
3. Wait until it's ready — don't sleep blindly:
   `node .claude/skills/verify/wait-for-app.mjs`
   If it times out: PostgreSQL may be down (`docker compose -f docker-compose.dev.yml up -d`),
   or the backend failed to compile — read `preview_logs` for the backend.
4. After you edit **backend** code, Nest restarts on its own: run `wait-for-app.mjs` again, and
   remember the restart **resets the fake mailbox** (log in with reset again).

## 3. Log in with a clean mailbox

`navigate` to `http://localhost:5173/api/auth/dev-login?reset=1` → lands on `/inbox`.
- 404 → `DEV_LOGIN=true` is missing from `.env`. Stop and ask the user to add it
  (never read or edit `.env` yourself).
- Reset restores the fixtures and clears synced data, so Senders shows "Never synced" —
  click `sync-now` first when checking Senders.

## 4. Exercise the feature like a user

- **Click with refs, not coordinates.** Use `find` (by visible text or aria-label) to get a
  `ref_N`, then `computer left_click` with that ref. Coordinates from a scaled screenshot miss.
- **Assert with `data-testid`s** via `javascript_tool`, not by eyeballing screenshots. This probe
  shows the state of the page in one call:

  ```js
  ({
    path: location.pathname + location.search,
    title: document.querySelector('[data-testid=mail-list-title]')?.innerText,
    rows: [...document.querySelectorAll('[data-testid=mail-row]')].slice(0, 10)
      .map((r) => r.dataset.messageId + (r.dataset.unread ? ' (unread)' : '')),
    openEmail: document.querySelector('[data-testid=message-view]')?.dataset.messageId,
    notifications: [...document.querySelectorAll('.mantine-Notification-root')].map((n) => n.innerText),
    modal: document.querySelector('.mantine-Modal-content')?.innerText.slice(0, 300),
  })
  ```

- Use `javascript_tool` only to read state (and the one exception below) — make real changes
  through clicks and typing, the way a user would.
- Batch predictable steps in `browser_batch` (click → wait 1–2 s → probe).
- Compare against the fixture facts in the feature map (ids, counts per sender), not guesses.

### Known traps

| Trap | What to do |
|---|---|
| Undo notification closes after **6 s** | Trigger the action and click `[data-testid=undo]` in the **same** `javascript_tool` call (await ~1 s between) — the one allowed JS click |
| Email body iframe loads ~1 s after the drawer | Wait before screenshotting; check content via the iframe's `srcdoc` |
| Refs go stale after navigation or re-render | `find` again instead of reusing old refs |
| A click right after the drawer/modal closes does nothing | The closing animation swallows it — wait ~1.5 s, then confirm the URL/state changed |
| 502s in the console | Requests made while the backend was starting — ignore only if they happened before `wait-for-app` succeeded |
| Senders empty after reset | Expected — run Sync first |
| Bulk actions (Organize) are background jobs | Wait for the notification "Done — N emails updated" (2–3 s) before asserting |

## 5. Check for errors

- `read_console_messages` with `onlyErrors: true` — every error must be explained
  (expected 4xx from a negative test, or startup 502s). Unexplained = failure.
  The console log **survives navigation** and keeps errors from earlier runs in the same tab:
  read it once right after logging in (step 3) as a baseline and only judge what's new.
- `preview_logs` for the backend with `level: "error"`.

## 6. Proof and report

- Take one `screenshot` of the final state that shows the change.
- Report a short table: each check → ✅ / ❌ with the observed value
  (e.g. "Trash 2 emails → rows gone, notification '2 emails moved to Trash'").
- Any ❌, or a check you couldn't run → say so plainly; don't call the change done.
- If you found a bug outside the change, mention it — don't fix it unasked.
- New UI control without a `data-testid`, or a feature that behaves differently from
  `docs/feature-map.md` → add the test id / update the map as part of the change.
