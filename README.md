# Mail organizer

A personal site to organize a messy Gmail inbox: browse, trash, tag, move, search,
and group emails by sender. Built to support other providers (Outlook, IMAP) later.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + TypeScript + Vite, Mantine, TanStack Query, React Router |
| Backend | NestJS (TypeScript), `googleapis` |
| Database | PostgreSQL + Prisma (no migrations — `prisma db push`) |
| Jobs | pg-boss (on PostgreSQL, no Redis) |
| Deploy | Docker Compose + Caddy (automatic HTTPS) on a VPS — manual deploy, no CI/CD |

## Project structure

```
.
├── docker-compose.yml        # production: postgres + backend + web (Caddy)
├── docker-compose.dev.yml    # local dev: only postgres (localhost:5433)
├── Caddyfile                 # serves the React app, proxies /api to the backend
├── .env.example              # copy to .env
├── backend/
│   ├── prisma/schema.prisma  # all tables live here (single source of truth)
│   ├── docker-entrypoint.sh  # runs `prisma db push`, then starts the API
│   └── src/
│       ├── config/           # env validation (zod)
│       ├── common/           # session guard, token encryption, validation
│       ├── jobs/             # pg-boss queues (sync, bulk actions)
│       ├── mail-providers/   # provider interface + gmail/ implementation
│       └── modules/          # auth, accounts, sync, messages, labels, senders
└── frontend/src/
    ├── api/                  # fetch client, React Query hooks, types
    ├── features/             # message actions, tags, senders dialogs
    ├── layouts/, components/
    └── pages/                # Login, Privacy, MailList, Senders, Tags
```

## Database without migrations

Tables are defined only in `backend/prisma/schema.prisma`. After changing it, run
`npm run db:push` (in Docker it runs on every start). If a change would lose data
(e.g. renaming or removing a field), it stops and explains instead of dropping anything.

## 1. Google setup (once)

In [Google Cloud Console](https://console.cloud.google.com/):

1. **Create a project**, then **APIs & Services → Library → Gmail API → Enable**.
2. **Google Auth Platform → Branding**
   - App name **without** "Gmail" or "Google" (e.g. `Mail Organizer`), or creation fails.
   - Support email and developer contact email: your email.
   - **No logo** (it forces Google verification). Leave the other fields empty for now.
3. **Audience** → User type **External**, keep status **Testing**, and under
   **Test users** add your email (and your friends').
4. **Data Access** → nothing to add. The app requests the Gmail permissions itself at login.
5. **Clients → Create client → Web application**, redirect URI:
   `http://localhost:5173/api/auth/google/callback`
6. Copy the client ID and secret into `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).

In Testing mode Google asks you to log in again every 7 days. That goes away once the
app is published (see [Deploy](#3-deploy-on-the-vps)).

## 2. Local development

```bash
cp .env.example .env    # fill GOOGLE_* and TOKEN_ENCRYPTION_KEY (command in the file)
docker compose -f docker-compose.dev.yml up -d
cd backend && npm install && npm run db:push && npm run prisma:generate
cd ../frontend && npm install
cd .. && npm run hooks:install   # pre-commit: typecheck + lint + tests
```

Then, in two terminals from the project root:

```bash
npm --prefix backend run start:dev    # API on http://localhost:3000/api
npm --prefix frontend run dev         # site on http://localhost:5173
```

**Without Google (fake mailbox):** set `DEV_LOGIN=true` in `.env` and click **Dev login
(fake mailbox)** on the login page — ~200 generated emails, no Google account needed. Add
`?reset=1` (the button does) to start from a clean state. See `docs/feature-map.md`.

**First use:** open http://localhost:5173 → **Continue with Google** → on the
"unverified app" warning choose **Advanced → Go to app** → tick **both** Gmail
permissions. Then open **Senders → Sync** to copy your email metadata (only needed
for the Senders view; click Sync again whenever you want fresh numbers).

## 3. Deploy on the VPS

Needs Docker, a domain (or a free DuckDNS subdomain) pointing at the VPS, and ports
80/443 open.

```bash
git clone <repo> && cd <repo>
cp .env.example .env    # set DOMAIN, a strong POSTGRES_PASSWORD, GOOGLE_*, TOKEN_ENCRYPTION_KEY
docker compose up -d --build
```

Then publish the Google app so logins stop expiring:

1. **Clients** → your client → add the redirect URI
   `https://<your-domain>/api/auth/google/callback`.
2. **Branding** → Home page `https://<your-domain>`, Privacy policy
   `https://<your-domain>/privacy`, Authorized domain `<your-domain>`.
   Both pages are served by this project (login page and `PrivacyPage.tsx`), no login needed.
3. **Audience → Publish app**. Ignore "verification required" — don't submit anything.

Update after changes:

```bash
git pull && docker compose up -d --build
```

Optional daily backup (cron on the VPS):

```bash
docker compose exec -T postgres pg_dump -U mail mail_organizer | gzip > backup-$(date +%F).sql.gz
```
