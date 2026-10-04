# Backend (NestJS)

ESM project: relative imports end in `.js` (`import { X } from './x.service.js'`).
`npm run typecheck`, `npm test` (Vitest, `*.spec.ts` next to the code, excluded from the build).

## Layout

```
src/
  config/          env validation (zod) — add new variables to env.ts AND .env.example
  common/          SessionGuard, @CurrentUserId, ZodValidationPipe, token cipher, provider error filter
  prisma/          PrismaService
  jobs/            pg-boss queues (QUEUES) — long work runs here, not in requests
  mail-providers/  MailProvider interface, registry, provider errors, gmail/ and fake/ implementations
  modules/<name>/  one folder per feature: <name>.module/controller/service(.schemas).ts
  generated/       Prisma client (generated, gitignored — run `npm run prisma:generate`)
```

## Layering (follow it, don't shortcut it)

```
controller  →  service  →  AccountsService.getProviderContext()  →  MailProvider
                       ↘  PrismaService / MessageStoreService
```

- **Controllers** are thin: `@UseGuards(SessionGuard)`, `@CurrentUserId()`, validate every
  body/query with `new ZodValidationPipe(schema)` (small schemas inline at the top of the
  controller, like `labels.controller.ts`; many/shared ones in `<name>.schemas.ts`, like
  `messages.schemas.ts`), then call one service method. Routes are scoped by `accounts/:accountId/...`.
- **Services** get the provider via `accounts.getProviderContext(userId, accountId)`, which also
  checks ownership. Never load a `MailAccount` without checking `userId`.
- After a provider action, update the synced rows (`MessageStoreService`) so the Senders
  view stays correct without a new sync (see `messages.service.ts`).
- **Provider code** (`mail-providers/<provider>/`) is the only place that may import
  `googleapis` or provider SDKs — enforced by lint for `modules/`, `common/`, `jobs/`, `config/`
  and `prisma/`. The single exception is `modules/auth/dev-login.service.ts` (it creates the
  fake account); don't add others. Tests (`*.spec.ts`) may import the fake provider anywhere,
  but never `googleapis` or the real Gmail provider. It throws `ProviderAuthError` / `ProviderRequestError` /
  `ProviderNotFoundError`; `ProviderExceptionFilter` maps them to HTTP. Don't catch them in services.
- Bulk work over many emails (by sender / search) is a pg-boss job that returns a row to poll
  (`BulkAction`, `SyncRun`). Jobs never retry automatically.

## Database

- Schema only in `prisma/schema.prisma`. No migrations. Prefer additive changes
  (new optional fields, new tables); renames/removals make `db push` refuse.
- Store email **metadata only**; bodies are fetched live from the provider.
- Provider tokens are always encrypted with `TokenCipherService`.

## Fake provider (dev only)

`mail-providers/fake/` is an in-memory `MailProvider` with deterministic fixtures, enabled by
`DEV_LOGIN=true` (startup fails if set in production) and reached via `GET /api/auth/dev-login?reset=1`
(`modules/auth/dev-login.service.ts`).
When you add a method to `MailProvider`, implement it in **both** providers and add a test in
`fake.provider.spec.ts`. Keep the fake's behavior faithful to Gmail's (e.g. Trash/Spam excluded
from searches) — it's what every agent verification runs against.
