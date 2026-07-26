# ai-art-platform

AI Art operations platform — React/TypeScript rebuild. This PR
(**PR-01 Repository and Monorepo Foundation**) builds only the pnpm/Turborepo
monorepo foundation. No business features (tenants, auth, LINE, image
generation, reservations, payments, ...) are implemented yet — see
`OPEN_QUESTIONS_PR01.md` and the design doc
`AI_ART_PLATFORM_REDESIGN_MASTER_PLAN_PR01.md` for what comes next.

**The legacy PHP application (`team478a/ai-art-school`) is not modified by
this repository and is referenced only as a specification source.**

## Prerequisites

- Node.js 22.x (see `.nvmrc`)
- [Corepack](https://nodejs.org/api/corepack.html) (ships with Node 22).
  Corepack reads the pinned pnpm version from `package.json`'s
  `packageManager` field and installs/uses exactly that version — no manual
  `npm install -g pnpm` needed on any OS.
- Works the same on macOS, Linux, and Windows (PowerShell or Git Bash) — see
  "Getting started" below.

## Directory layout

```text
apps/
  admin-web    Admin console shell (React + TypeScript + Vite)
  liff-web     LIFF / end-user shell (React + TypeScript + Vite)
  api          API foundation (NestJS)
  worker       Background worker process foundation (Node)
packages/
  api-contracts  Shared Zod API contracts
  domain         Framework-free domain modeling primitives
  ui             Minimal shared React components
  config         Environment variable loading/validation
  logger         Structured logging with secret redaction
  test-utils     Shared test helpers
docs/
  ARCHITECTURE.md            Module boundaries and TypeScript decisions
OPEN_QUESTIONS_PR01.md       Recorded open questions / decisions for this PR (repo root)
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

This step is optional — every app boots with working defaults (see the
table below) even without a `.env` file.

| Variable    | Required | Default       | Notes                                    |
| ----------- | -------- | ------------- | ---------------------------------------- |
| `NODE_ENV`  | No       | `development` | One of `development`/`test`/`production` |
| `LOG_LEVEL` | No       | `info`        | One of Pino's levels (`fatal`...`trace`) |

`apps/api` and `apps/worker` validate these at startup via
`@ai-art-platform/config` and exit with a readable error if a value is
invalid (e.g. `NODE_ENV=not-a-real-env`). No database, LINE, Stripe, or
image-generation-provider variables exist yet — they are introduced by the
PRs that implement those integrations.

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

## PR policy

- One PR implements one scope from the master plan's Phase 1 split
  (PR-01 through PR-06). Out-of-scope work must not be added "while we're at
  it" — record it in the relevant `OPEN_QUESTIONS_*.md` instead.
- The legacy PHP repository (`team478a/ai-art-school`) is a specification
  reference only. Do not copy or port its code.
