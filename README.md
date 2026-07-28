# ai-art-platform

AI Art operations platform — React/TypeScript rebuild.
**PR-01 (Repository and Monorepo Foundation)** built the pnpm/Turborepo
monorepo foundation. **PR-02 (Database and Tenant Foundation)** adds
PostgreSQL/Prisma, a local Docker dev database, and the Tenant domain.
**PR-03A (Admin Authentication, Session and RBAC Foundation)** adds
DB-backed Admin login/session/CSRF/lockout and a fixed RBAC Permission
Matrix (no general User, LINE, or business features yet — see
`OPEN_QUESTIONS_PR01.md`, `OPEN_QUESTIONS_PR02.md`,
`OPEN_QUESTIONS_PR03A.md`, and the design doc
`AI_ART_PLATFORM_REDESIGN_MASTER_PLAN_PR01.md` for what comes next).

**The legacy PHP application (`team478a/ai-art-school`) is not modified by
this repository and is referenced only as a specification source.**

## Prerequisites

- Node.js 22.x (see `.nvmrc`)
- [Corepack](https://nodejs.org/api/corepack.html) (ships with Node 22).
  Corepack reads the pinned pnpm version from `package.json`'s
  `packageManager` field and installs/uses exactly that version — no manual
  `npm install -g pnpm` needed on any OS.
- **Docker Desktop** (or another Docker Engine + Compose v2) — only needed
  if you run `apps/api` against a real database (`pnpm db:up`). Everything
  else (`admin-web`, `liff-web`, `worker`, and `apps/api`'s `/health`
  endpoint) works without Docker.
- Works the same on macOS, Linux, and Windows (PowerShell or Git Bash) — see
  "Getting started" below.

## Directory layout

```text
apps/
  admin-web    Admin console shell (React + TypeScript + Vite)
  liff-web     LIFF / end-user shell (React + TypeScript + Vite)
  api          API foundation (NestJS) — Tenant domain + Admin Auth/RBAC + Public Tenant Resolve
  worker       Background worker process foundation (Node)
packages/
  api-contracts  Shared Zod API contracts (incl. Tenant and Admin Auth schemas)
  domain         Framework-free domain modeling primitives (incl. Tenant, Admin Auth)
  database       Prisma Client generation/sharing (no business logic)
  ui             Minimal shared React components
  config         Environment variable loading/validation (incl. DB + Admin Auth env)
  logger         Structured logging with secret redaction
  test-utils     Shared test helpers
prisma/
  schema.prisma       Source of truth for the database schema
  migrations/          Committed SQL migrations
  seed.ts              Idempotent seed (creates the "default" Tenant)
  admin-bootstrap.ts   `pnpm admin:bootstrap` — creates the first Admin (PR-03A)
docs/
  ARCHITECTURE.md                        Module boundaries and TypeScript decisions (PR-01)
  architecture/ID_POLICY.md              Member ID format decisions (PR-02)
  architecture/TENANT_POLICY.md          Tenant/LINE/Admin-role policy decisions (PR-02)
  architecture/DATABASE_BOUNDARIES.md    Layering rules (PR-02)
  architecture/ADMIN_AUTH_POLICY.md      Admin login/session/lockout policy (PR-03A)
  architecture/RBAC_POLICY.md            Permission Matrix and Tenant boundary rules (PR-03A)
  security/SESSION_COOKIE_CSRF_POLICY.md Session/Cookie/CSRF mechanics (PR-03A)
  database/ER_DIAGRAM_PR02.md            Entity-relationship diagram (PR-02)
  database/MIGRATION_POLICY.md           Migration workflow and rules (PR-02)
  development/LOCAL_DATABASE.md          Local Postgres reference (PR-02)
  development/ADMIN_BOOTSTRAP.md         Admin Bootstrap CLI reference (PR-03A)
OPEN_QUESTIONS_PR01.md / OPEN_QUESTIONS_PR02.md / OPEN_QUESTIONS_PR03A.md   Recorded open questions (repo root)
```

See each app's/package's own `README.md` for its specific responsibility.

## Getting started

macOS / Linux (bash/zsh):

```bash
corepack enable
pnpm install
pnpm dev
```

Windows (PowerShell):

```powershell
corepack enable
pnpm install
pnpm dev
```

The commands are identical on Windows — every script in this repo (`dev`,
`build`, `lint`, `typecheck`, `test`, `format`, `format:check`, `clean`) is
implemented with cross-platform Node.js CLI tools only (no `rm`, `cp`, or
other Unix-only shell commands), so there is nothing OS-specific to adjust.
If you use **Git Bash** on Windows instead of PowerShell, the `bash`
examples in this README work as-is.

`pnpm dev` starts all four apps concurrently:

| App       | URL                                |
| --------- | ---------------------------------- |
| admin-web | http://localhost:5173              |
| liff-web  | http://localhost:5174              |
| api       | http://localhost:3000              |
| worker    | (no HTTP endpoint; logs to stdout) |

Press `Ctrl+C` once to stop all of them.

`apps/api` boots even without a database — `/` and `/health` work either
way. `/ready` and `/api/v1/public/tenants/:tenantKey` need a running,
migrated, seeded database (see "Database" below).

## Database

`apps/api` uses PostgreSQL 16 via Prisma. Locally this runs in Docker,
started separately from `pnpm dev`:

```bash
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
pnpm install
pnpm db:up                    # starts Postgres 16 in Docker (docker compose)
pnpm db:generate               # generates the Prisma Client (also required once after every `pnpm install`)
pnpm db:migrate:dev            # applies migrations (creates one if the schema changed)
pnpm db:seed                   # idempotent — creates/updates the "default" Tenant
```

These four `db:*` commands are identical on Windows PowerShell, macOS, and
Linux — they only invoke `docker compose` and `prisma`, both cross-platform
CLIs.

Then start the API (`pnpm --filter @ai-art-platform/api dev`, or root
`pnpm dev` for all four apps) and confirm:

```bash
curl http://localhost:3000/ready
curl http://localhost:3000/api/v1/public/tenants/default
```

| Command                       | Purpose                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `pnpm db:up` / `pnpm db:down` | Start / stop the local Postgres container. `db:down` keeps the named volume (your data survives).    |
| `pnpm db:logs`                | Tail the Postgres container's logs.                                                                  |
| `pnpm db:generate`            | Regenerate the Prisma Client (not committed to git).                                                 |
| `pnpm db:validate`            | Validate `prisma/schema.prisma` without a database connection.                                       |
| `pnpm db:migrate:dev`         | Create + apply a migration from schema changes (local dev only).                                     |
| `pnpm db:migrate:deploy`      | Apply existing migrations without generating new ones (CI).                                          |
| `pnpm db:seed`                | Idempotent seed — safe to re-run.                                                                    |
| `pnpm db:studio`              | Open Prisma Studio (local DB browser GUI).                                                           |
| `pnpm test:integration`       | Run `apps/api`'s DB-backed integration tests.                                                        |
| `pnpm admin:bootstrap`        | Create the first `SUPER_ADMIN` or Tenant admin — see `docs/development/ADMIN_BOOTSTRAP.md` (PR-03A). |

**⚠️ `pnpm db:migrate:dev`/`db:migrate:deploy` must never be pointed at a
staging or production database from a developer machine.** PR-02 does not
apply any migration to Supabase or to the legacy PHP database — see
`docs/database/MIGRATION_POLICY.md`.

To wipe your local database entirely (fresh volume):

```bash
pnpm db:down
docker volume rm ai-art-platform_ai_art_platform_pgdata   # `docker volume ls` to confirm the exact name
pnpm db:up
pnpm db:migrate:dev
pnpm db:seed
```

More detail (Prisma Studio, port conflicts, resetting, running integration
tests without Docker): `docs/development/LOCAL_DATABASE.md`.

## Common commands

```bash
pnpm build        # Build every app/package
pnpm lint         # ESLint across the monorepo
pnpm typecheck    # tsc --noEmit across the monorepo
pnpm test         # Vitest across the monorepo
pnpm format       # Prettier --write
pnpm format:check # Prettier --check (used in CI)
pnpm clean        # Remove build outputs and caches
```

Each command is a thin wrapper over `turbo run <task>`; Turborepo runs each
workspace's script and caches results (see `turbo.json`).

## Environment variables

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env       # macOS/Linux/Git Bash
```

```powershell
Copy-Item .env.example .env   # PowerShell
```

`admin-web`, `liff-web`, and `apps/worker` boot with working defaults even
without a `.env` file. **`apps/api` requires `DATABASE_URL`,
`DATABASE_DIRECT_URL`, `ADMIN_WEB_ORIGIN`, and `AUTH_IP_HASH_SECRET`** (see
"Database" above and `docs/architecture/ADMIN_AUTH_POLICY.md` for the
PR-03A admin-auth variables) — `.env.example`'s defaults already match
`compose.yaml`, so copying it is enough for local development.

| Variable                           | Required (app)        | Default            | Notes                                                                                                 |
| ---------------------------------- | --------------------- | ------------------ | ----------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                         | No                    | `development`      | One of `development`/`test`/`production`                                                              |
| `LOG_LEVEL`                        | No                    | `info`             | One of Pino's levels (`fatal`...`trace`)                                                              |
| `DATABASE_URL`                     | Yes (`apps/api` only) | none — must be set | Runtime connection. Never sent to a browser bundle (no `VITE_` prefix).                               |
| `DATABASE_DIRECT_URL`              | Yes (`apps/api` only) | none — must be set | Direct (non-pooled) connection, used by `prisma migrate`.                                             |
| `ADMIN_WEB_ORIGIN`                 | Yes (`apps/api` only) | none — must be set | Exact-match CORS origin for `apps/admin-web` (PR-03A).                                                |
| `AUTH_IP_HASH_SECRET`              | Yes (`apps/api` only) | none — must be set | HMAC key (≥16 chars) for hashing IP/User-Agent/email (PR-03A). Real secret in any shared environment. |
| `ADMIN_SESSION_TTL_SECONDS`        | No                    | `28800` (8h)       | Admin Session Cookie lifetime (PR-03A).                                                               |
| `ADMIN_LOGIN_WINDOW_SECONDS`       | No                    | `900` (15m)        | IP-level login rate-limit window (PR-03A).                                                            |
| `ADMIN_LOGIN_ACCOUNT_MAX_FAILURES` | No                    | `5`                | Consecutive failures before Account Lockout (PR-03A).                                                 |
| `ADMIN_LOGIN_IP_MAX_FAILURES`      | No                    | `20`               | Failures per IP before rate-limiting (PR-03A).                                                        |
| `ADMIN_LOCKOUT_SECONDS`            | No                    | `900` (15m)        | Account Lockout duration (PR-03A).                                                                    |

`apps/api` validates its full env (including the two DB variables) at
startup via `@ai-art-platform/config`'s `apiEnvSchema` and exits with a
readable error if a value is missing/invalid. Both DB variables are
redacted if ever logged (`packages/logger`'s redaction list). No LINE,
Stripe, or image-generation-provider variables exist yet — they are
introduced by the PRs that implement those integrations.

## Working on an internal package

Packages compile to `dist/` and are consumed from there (see
`docs/ARCHITECTURE.md`). If you change a package's source while an app's dev
server is running, also run that package's own watcher in another terminal:

```bash
pnpm --filter @ai-art-platform/ui dev
```

(`pnpm dev` at the repo root already runs every package's watcher plus every
app's dev server concurrently, so this is only needed if you started a
single app in isolation with `--filter`.)

## Troubleshooting

- **`pnpm install --frozen-lockfile` fails**: the lockfile is out of date
  with `package.json`. Run `pnpm install` (without the flag) locally, review
  the diff, and commit the updated `pnpm-lock.yaml`.
- **`Cannot find module '@ai-art-platform/...'` during typecheck/build**:
  an internal package hasn't been built yet. Run `pnpm build` once, or rely
  on `pnpm dev`/`pnpm typecheck`, which build dependencies automatically via
  Turborepo (`dependsOn: ["^build"]`).
- **Port already in use**: `admin-web` (5173), `liff-web` (5174), and `api`
  (3000) must be free. Stop any other process using those ports.
  - macOS/Linux: `lsof -i :5173` (repeat per port) to find the PID, then
    `kill <PID>`.
  - Windows (PowerShell): `Get-NetTCPConnection -LocalPort 5173` to find the
    PID, then `Stop-Process -Id <PID>`.
- **Env validation error on startup**: the error message lists exactly which
  variable is invalid/missing — fix `.env` accordingly.
- **`pnpm clean` doesn't work on Windows**: it shouldn't happen — every
  `clean` script uses `rimraf` (a cross-platform Node.js package), not `rm
-rf`. If you see a Unix-only command fail, please file an issue.
- **`/ready` returns 503 / `apps/api` won't validate its env**: `DATABASE_URL`
  and `DATABASE_DIRECT_URL` are required. Confirm `.env` exists (copied from
  `.env.example`) and that `pnpm db:up` succeeded.
- **Port 5432 already in use**: another local Postgres is already running.
  Either stop it, or change the host port in `compose.yaml` (and the port
  in `.env`'s `DATABASE_URL`/`DATABASE_DIRECT_URL`) — see
  `docs/development/LOCAL_DATABASE.md`.
  - macOS/Linux: `lsof -i :5432` to find the PID.
  - Windows (PowerShell): `Get-NetTCPConnection -LocalPort 5432`.
- **`pnpm db:generate` / `pnpm db:migrate:dev` fails with a connection
  error**: Docker Desktop isn't running, or `pnpm db:up` wasn't run first.

## PR policy

- One PR implements one scope from the master plan's Phase 1 split
  (PR-01 through PR-06). Out-of-scope work must not be added "while we're at
  it" — record it in the relevant `OPEN_QUESTIONS_*.md` instead.
- The legacy PHP repository (`team478a/ai-art-school`) is a specification
  reference only. Do not copy or port its code.
