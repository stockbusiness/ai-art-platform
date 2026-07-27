# Local Database — PR-02

Reference for `apps/api` local development. See the root `README.md` for
the condensed quick-start version.

## Prerequisites

- Docker Desktop (or another Docker Engine + Compose v2) running locally.
- `.env` created from `.env.example` (`cp .env.example .env` on
  macOS/Linux/Git Bash, `Copy-Item .env.example .env` on PowerShell). The
  default values already match `compose.yaml`.

## Everyday commands

| Command                  | What it does                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm db:up`             | Starts the local Postgres 16 container (detached).                                                                                                                |
| `pnpm db:down`           | Stops and removes the container (the named volume, and therefore your data, survives).                                                                            |
| `pnpm db:logs`           | Tails the Postgres container's logs.                                                                                                                              |
| `pnpm db:generate`       | Regenerates the Prisma Client into `packages/database/generated/` (not committed — run this after every `pnpm install` and after editing `prisma/schema.prisma`). |
| `pnpm db:validate`       | Validates `prisma/schema.prisma` syntax without touching a database.                                                                                              |
| `pnpm db:migrate:dev`    | Creates and applies a new migration from schema changes (local development only).                                                                                 |
| `pnpm db:migrate:deploy` | Applies existing migrations without generating new ones (CI/deploy).                                                                                              |
| `pnpm db:seed`           | Upserts the `default` Tenant (idempotent — safe to run repeatedly).                                                                                               |
| `pnpm db:studio`         | Opens Prisma Studio, a local GUI for browsing the database.                                                                                                       |
| `pnpm test:integration`  | Runs `apps/api`'s Repository/API integration tests. Prefers `TEST_DATABASE_URL` if set; otherwise starts a disposable Testcontainers Postgres automatically.      |

## First-time setup

```bash
cp .env.example .env       # or Copy-Item .env.example .env on PowerShell
pnpm install
pnpm db:up
pnpm db:generate
pnpm db:migrate:dev
pnpm db:seed
```

Then `pnpm --filter @ai-art-platform/api dev` (or root `pnpm dev`, which
starts every app) and confirm:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
curl http://localhost:3000/api/v1/public/tenants/default
```

## Resetting your local database

To start over from an empty database:

```bash
pnpm db:down
docker volume rm ai-art-platform_ai_art_platform_pgdata   # exact name may vary; `docker volume ls` to check
pnpm db:up
pnpm db:migrate:dev
pnpm db:seed
```

(`pnpm db:down` alone does not delete the named volume — this is
intentional, so a normal stop/start cycle doesn't lose your local data.)

## Port conflicts

If `5432` is already bound by another local Postgres, edit the host-side
port in `compose.yaml` (e.g. `"55432:5432"`) and update `DATABASE_URL`/
`DATABASE_DIRECT_URL` in `.env` to match the new port. See README.md's
Troubleshooting section for how to find what's currently using the port on
each OS.

## Integration tests without Docker running

If `TEST_DATABASE_URL` is set (e.g. to a database you migrated by hand, or
to the same database `pnpm db:up` starts), `pnpm test:integration` uses it
directly instead of starting a Testcontainers Postgres. This is also what
the `database` CI job does, pointing it at a separate database from the
one `db:seed` populates so the two suites never interfere with each other.
