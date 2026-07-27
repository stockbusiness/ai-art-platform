# Database Boundaries — PR-02

## Layering

```text
apps/api/src/modules/tenant/
├── presentation/    Controllers. HTTP only — no Prisma import.
├── application/     UseCases. Depend on packages/domain's TenantRepository
│                    port (a string token + TypeScript interface), never
│                    on Prisma directly.
└── infrastructure/  PrismaTenantRepository (implements the port) +
                     Prisma <-> Domain mappers. The only place in this
                     module allowed to import @ai-art-platform/database.

packages/domain/src/tenant/    Tenant, TenantKey, TenantStatus, domain
                                errors, TenantRepository port. Zero
                                dependency on Prisma, NestJS, React, or Zod
                                (enforced structurally — see
                                packages/domain/src/domain-purity.test.ts).

packages/database/              Prisma Client generation/sharing only. No
                                business logic, no Controllers, no HTTP
                                DTOs, and never imported by packages/domain.
```

Rule of thumb: a Controller never imports `@ai-art-platform/database`
directly, and `packages/domain` never imports it at all. Everything a
Controller needs comes through a UseCase; everything a UseCase needs from
persistence comes through the `TenantRepository` port.

## Why a DI token instead of injecting the interface directly

`TenantRepository` is a TypeScript interface — it has no runtime
representation, so NestJS's reflection-based DI can't use it as an
injection token by itself. `packages/domain` exports a plain string
constant, `TENANT_REPOSITORY`, alongside the interface (still
framework-free — it's just a string). `apps/api`'s `TenantModule` binds
that token to `PrismaTenantRepository`:

```ts
{ provide: TENANT_REPOSITORY, useClass: PrismaTenantRepository }
```

and UseCases inject it with `@Inject(TENANT_REPOSITORY)`. This keeps the
port definition framework-free while still giving Nest something concrete
to wire up.

## Runtime vs. Migration connection

Two separate connection strings, both required by `apiEnvSchema`
(`packages/config/src/env.ts`):

| Env var               | Used by                               | Notes                                                                            |
| --------------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`        | API runtime queries (`PrismaService`) | May point at a connection pooler (e.g. Supabase's Pooler) in staging/production. |
| `DATABASE_DIRECT_URL` | `prisma migrate *`                    | Must be a direct connection — migrations cannot run through a pooler.            |

Locally both point at the same `compose.yaml` Postgres, so a single value
works for both.

## Neither URL ever reaches a browser bundle

- `apiEnvSchema` lives in `packages/config` and is only imported by
  `apps/api`'s `main.ts` — `admin-web` and `liff-web` never import it.
- Vite only exposes environment variables prefixed `VITE_` to client code;
  `DATABASE_URL`/`DATABASE_DIRECT_URL` are not, and never will be,
  prefixed that way.
- `packages/logger`'s redaction list includes `databaseUrl`,
  `databaseDirectUrl`, `DATABASE_URL`, and `DATABASE_DIRECT_URL` (both
  casings, since call sites log either the parsed env object or raw
  `process.env` values) — see `packages/logger/src/redaction.ts`.

## No admin/business HTTP surface in PR-02

`CreateTenantUseCase` and `UpdateTenantUseCase` exist and are covered by
tests, but no Controller calls them. PR-02 exposes exactly one public
endpoint (`GET /api/v1/public/tenants/:tenantKey`) plus `/health` and
`/ready`. An unauthenticated Tenant-management API is deliberately not
built before PR-03 adds Admin auth/RBAC — see section 13.4 of the PR-02
instructions.
