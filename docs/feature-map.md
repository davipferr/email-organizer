# Feature map

How to reach and check every feature in the running app. Written for agents (and
humans) verifying changes in the browser. Keep it updated when a feature changes.

## Setup

1. PostgreSQL: `docker compose -f docker-compose.dev.yml up -d`
2. `DEV_LOGIN=true` in `.env`; schema applied (`npm --prefix backend run db:push`)
3. Start `backend` and `frontend` from `.claude/launch.json` (preview tools) — or, in a
   worktree, your slot's `backend-N`/`frontend-N` (see `docs/working-with-claude.md`; ports
   below assume slot 0). The backend takes ~10 s to compile; `/api/*` returns 502 until then.
4. Open **http://localhost:5173/api/auth/dev-login?reset=1**: logs in as `dev@fake.local`, resets
   the fake mailbox to the fixtures, deletes all synced data (Senders shows "Never synced"),
   and lands on `/inbox`. Same as the **Dev login (fake mailbox)** button on `/login`.

Never use "Continue with Google" or a real mailbox for testing.

## Fake mailbox (fixtures)

Defined in `backend/src/mail-providers/fake/fake-mailbox.ts`. Same emails and ids on every
reset (`fake-0001` is the newest); dates move with the current time.

| Sender | Emails | Notes |
|---|---|---|
| `noreply@medium.com` | 40 | tag Newsletters, mostly unread, some archived, List-Unsubscribe |
| `noreply@github.com` | 35 | plain text only, some archived |
| `todomundo@nubank.com.br` | 25 | tags Finance + Finance/Bills, some starred |
| `no-reply@amazon.com` | 22 | promotions, List-Unsubscribe |
| `notifications@linkedin.com` | 20 | mostly unread, List-Unsubscribe |
| `deals@shop.example` | 15 + 6 in Trash | promotions, mostly unread, List-Unsubscribe with an https link first |
| `orders@amazon.com` | 10 | tag Receipts, 180 KB attachments (same domain as Amazon above) |
| `ana.souza@gmail.com` | 8 | personal, starred, one thread "Trip plans" |
| `booking@skyair.example` | 6 | tag Travel |
| `john@company.example` | 5 | name with a comma ("Doe, John"), cc, 2.4 MB attachments |
| `dev@fake.local` | 5 | Sent |
| `winner@lottery.example` | 4 | Spam (hidden everywhere) |

Tags: `Label_1` Finance, `Label_2` Finance/Bills, `Label_3` Travel, `Label_4` Newsletters,
`Label_5` Receipts. New tags get `Label_6`, `Label_7`…

HTML emails contain a `<script>` and a remote image: the script must never appear in the
rendered email (`message-body` srcdoc).

The mailbox lives in the backend's memory: **a backend restart resets it** (the database keeps
the old synced rows until the next Sync, which then does a full sync automatically).

## Search syntax (fake provider)

`from:` (email, domain or name), `to:`, `subject:`, `label:` (id or slug, e.g.
`label:finance-bills`), `is:unread|read|starred`, `in:inbox|trash|spam|sent|anywhere`,
quoted phrases, free words (all must match). Trash/Spam are excluded unless asked for.

---

## Features

Selectors are `[data-testid=...]`. Rows carry extra attributes for checks:
`mail-row[data-message-id][data-unread]`, `sender-row[data-key]`, `tag-row[data-label-id]`,
`label-picker-option[data-label-id]`.

### Mail list — `/inbox`, `/label/:labelId`, `/search?q=`
- Sidebar: `nav-inbox`, `nav-starred`, `nav-sent`, `nav-trash`, `nav-tag-<labelId>`.
- Title `mail-list-title` ("Inbox", "Trash", tag name, or "Search: …").
- 50 per page; `page-next` / `page-prev`; `mail-refresh`. Empty state `mail-empty`.
- Unread rows are bold and have `data-unread`. User tags show as colored badges.
- Inbox only: each row has a Gmail category badge `mail-row-category[data-category]`
  (Primary / Promotions / Social, from `CATEGORY_*` labels; Updates and Forums count as
  Primary). Hovering it shows a tooltip describing the category.
- Check: in `/inbox`, `deals@shop.example` and `no-reply@amazon.com` rows are Promotions,
  `notifications@linkedin.com` rows are Social, Medium/GitHub/Nubank rows are Primary;
  `/label/Label_1` rows have no category badge.
- API: `GET /api/accounts/:id/messages?labelId=&q=&pageToken=`
- Check: Inbox has 50 rows and `page-next` enabled; `/label/TRASH` lists 6 `deals@shop.example`
  emails; `/label/SPAM` is not in the sidebar.

### Search — header box `search-input` (Enter)
- Navigates to `/search?q=…`. Example: `label:finance-bills is:unread` → only unread Nubank emails.

### Open an email — click a `mail-row`
- Drawer `message-view[data-message-id]` with actions bar, sender (link → `from:` search),
  To/date, tag badges, and the body iframe `message-body` (sandboxed, loads ~1 s later).
- Opening an unread email marks it read silently.
- API: `GET /api/accounts/:id/messages/:messageId`

### Select + actions — `mail-row-checkbox`, `select-all`
- Bar shows "N selected" and: `action-tag`, `action-move`, `action-archive` (only if in Inbox),
  `action-mark-read` (toggles read/unread), `action-trash`. In Trash: only `action-restore`.
- Tag / Move open a picker: `label-picker-filter`, `label-picker-option`, `label-picker-new-tag`.
- Every action shows a notification with **`undo`** — it **closes after 6 s**, so click Undo
  right away (same batch) when testing it.
- API: `POST .../messages/trash | untrash | labels | move` with `{ selector: { ids } }`
- Check: trash 2 rows → they leave the list → `undo` → they're back, "Undone" shown.

### Senders — `/senders` (`nav-senders`)
- After a reset: "Never synced" panel with `sync-now`.
- `sync-button` (incremental), `sync-options` → `sync-full`. Status text `sync-status`
  ("Syncing…", "Stopping…", "Last synced just now"). Sync of the fake mailbox takes ~1–2 s.
- Stop: while a sync runs, the progress panel has `sync-stop`. The run stays RUNNING
  ("Stopping…") until the worker stops, then ends CANCELLED: notification "Sync stopped" and
  a gray notice `sync-stopped` until the next sync. Emails stored so far stay; Sync is
  available again. To have time to click it, log in with
  `/api/auth/dev-login?reset=1&slowSync=1` (each batch of 50 takes 2 s, ~8 s in all).
- Table `sender-row[data-key]` (Emails, Unread, Latest, Size); `senders-group-by`
  (By email / By domain — `amazon.com` groups 2 senders, 32 emails), sort select,
  `senders-search`, pagination.
- `sender-view` → `/search?q=from:<key>`.
- Unsubscribe: `senders-unsubscribable` switch ("Can unsubscribe") keeps only senders with a
  List-Unsubscribe header — 4 after a reset (Medium, Amazon, LinkedIn, Shop Deals), counts
  still cover all their emails. Those rows get `sender-unsubscribe` (menu):
  `sender-unsubscribe-open` (a link: https in a new tab for Shop Deals, `mailto:` for the
  others — the app can't send email) and `sender-unsubscribe-trash` → confirm
  `unsubscribe-trash-confirm` opens the link and runs the "trash all from sender" job.
- `sender-organize` → modal: Add tag, Archive (default on), Mark as read, `organize-apply`,
  `organize-trash-all` (confirm modal). Runs a background job; progress notification ends with
  "Done — N emails updated". Emails already in Trash are not counted.
- API: `POST/GET /api/accounts/:id/sync`, `POST .../sync/cancel` (409 if none running),
  `GET .../senders[?unsubscribable=true]`,
  `POST/GET .../messages/bulk[/:id]`
- Check: slow sync → Stop at ~100/201 → CANCELLED, `sync-stopped` shown; Sync again →
  201/201, progress only goes up.
- Check: after Sync, `todomundo@nubank.com.br` shows 25; Organize `deals@shop.example` with
  defaults → 15 updated, none left in Inbox.

### Storage — `/storage` (`nav-storage`)
- Built from the synced copy; before the first sync shows "Sync your mailbox…" with `go-sync`.
- `storage-total` (14 MB after a reset + sync — Trash and Spam left out), senders by size
  `storage-sender[data-key]` (top: `john@company.example` 12 MB, then `orders@amazon.com`)
  with `storage-sender-organize` (same Organize dialog as Senders).
- Biggest emails `storage-row[data-id]` (top 5: John's 2.3 MB emails, `fake-0135` first),
  click opens the email drawer; `storage-row-checkbox`, `storage-select-all`,
  `storage-trash` ("Move to Trash (N, size)") → notification with `undo`. 50 per page.
- API: `GET .../storage?page=`
- Check: trash the top 2 → total drops to 9.2 MB; Undo → back to 14 MB.

### Stats — `/stats` (`nav-stats`)
- Built from the synced copy (Trash and Spam left out); "Sync your mailbox…" before a sync.
- Tiles `stats-total` (191 after a reset + sync), `stats-unread`, `stats-senders` (11),
  `stats-size`. Charts `stats-by-month` (12 bars), `stats-by-hour` (24, in the browser's
  time zone), `stats-by-weekday` (7, Mon–Sun), `stats-categories` with
  `stats-category[data-category]` (Primary / Promotions / Social), `stats-top-senders` with
  `stats-top-sender[data-key]` (Medium 40 first; click → `/search?q=from:<email>`).
- API: `GET .../stats?tz=<IANA zone>` (unknown zone → 400).

### Manage tags — `/tags` (`nav-tags`)
- `tag-row[data-label-id]` with Emails / Unread counts, sub-tags indented; `tag-edit`,
  `tag-delete` → `delete-tag-confirm` (option to delete sub-tags too).
- `tags-new` (or sidebar `nav-new-tag`) → form: `tag-form-name`, `tag-form-parent`, color
  swatches, `tag-form-save` (Enter also saves).
- Duplicate name (case-insensitive) → inline error "A tag with this name already exists".
- API: `GET .../labels?counts=true`, `POST/PATCH/DELETE .../labels[/:id]`
- Check: create "Work" → `Label_6` appears in the table and sidebar.

### Login / account
- `/login`: "Continue with Google" (real OAuth — don't use) and `dev-login` (dev builds only).
- `account-menu` → Reconnect Gmail (real OAuth — don't use), Log out.
- `/privacy`: public privacy policy.
