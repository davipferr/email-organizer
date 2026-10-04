# Mail organizer

A personal site to organize a messy Gmail inbox: browse, trash, tag, move, search,
and group emails by sender. Built to support other providers (Outlook, IMAP) later.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + TypeScript + Vite, Mantine, TanStack Query/Virtual, React Router |
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
│   ├── prisma.config.ts
│   ├── docker-entrypoint.sh  # runs `prisma db push`, then starts the API
│   └── src/
│       ├── main.ts, app.module.ts
│       ├── config/           # env validation (zod)
│       ├── prisma/           # PrismaService
│       ├── common/           # session guard, token encryption, validation pipe
│       ├── jobs/             # pg-boss (sync + bulk action queues)
│       ├── mail-providers/   # provider interface + gmail/ implementation
│       └── modules/          # auth, accounts, sync, messages, labels, senders, health
└── frontend/
    └── src/
        ├── main.tsx, router.tsx, theme.ts
        ├── api/client.ts     # fetch wrapper (cookie session)
        ├── layouts/          # AppShell: header + sidebar
        ├── components/
        └── pages/            # Login, MailList, Senders, Tags
```

## Database without migrations

Tables are defined only in `backend/prisma/schema.prisma`.
`prisma db push` makes the database match the schema — it runs automatically when the
backend container starts (and with `npm run db:push` in dev). If a change would lose
data (e.g. renaming or removing a field), it refuses and tells you why instead of
dropping anything.

## Google setup (once)

1. [Google Cloud Console](https://console.cloud.google.com/) → create a project.
2. Enable the **Gmail API**.
3. **OAuth consent screen**: User type *External*, add the scopes
   `gmail.modify` and `gmail.labels`, then set the publishing status to
   **In production** (do not submit for verification). This avoids the 7-day token
   expiry of "Testing" mode. Users will see an "unverified app" warning once.
4. **Credentials** → OAuth client ID → *Web application*. Authorized redirect URIs:
   - `http://localhost:5173/api/auth/google/callback`
   - `https://<your-domain>/api/auth/google/callback`
5. Put the client ID and secret in `.env`.

## Local development

```bash
cp .env.example .env          # fill GOOGLE_* and TOKEN_ENCRYPTION_KEY
docker compose -f docker-compose.dev.yml up -d

cd backend
npm install
npm run db:push
npm run prisma:generate
npm run start:dev             # http://localhost:3000/api

cd ../frontend
npm install
npm run dev                   # http://localhost:5173 (proxies /api to :3000)
```

## Deploy on the VPS

Requirements: Docker, a domain (or a free subdomain such as DuckDNS) pointing at the
VPS, ports 80 and 443 open.

```bash
git clone <repo> && cd <repo>
cp .env.example .env          # set DOMAIN, strong POSTGRES_PASSWORD, GOOGLE_*, TOKEN_ENCRYPTION_KEY
docker compose up -d --build
```

Update later:

```bash
git pull
docker compose up -d --build
```

Optional daily backup (cron on the VPS):

```bash
docker compose exec -T postgres pg_dump -U mail mail_organizer | gzip > backup-$(date +%F).sql.gz
```
