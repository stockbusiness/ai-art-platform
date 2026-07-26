# Architecture — PR-01 Monorepo Foundation

This document records the module boundaries and TypeScript decisions
established by PR-01. It only covers what PR-01 actually builds; business
architecture (Tenant, User, Class, Reservation, Entitlement, Generation,
Integration, ...) is defined progressively by later PRs per the master plan
(`AI_ART_PLATFORM_REDESIGN_MASTER_PLAN_PR01.md`).

## Monorepo layout

```text
apps/
  admin-web    React + TypeScript + Vite admin console shell.
  liff-web     React + TypeScript + Vite LIFF / end-user shell.
  api          NestJS API foundation (single dev-info route, no DB).
  worker       Standalone Node process foundation (no job processing).
packages/
  api-contracts  Shared Zod API contracts (currently: ApiErrorResponse only).
  domain         Framework-free domain modeling primitives (Result, Entity, DomainError).
  ui             Minimal shared React components (AppShell, LoadingState).
  config         Environment variable loading/validation (NODE_ENV, LOG_LEVEL only).
  logger         Pino logger with secret redaction.
  test-utils     Shared, feature-agnostic test helpers (withEnv).
```

Each app/package also carries its own `README.md` describing its
responsibility and non-goals in more detail.

## Dependency direction rules

- `packages/domain` must never depend on React, NestJS, Prisma, or any other
  framework/infrastructure package. It is enforced by omission (no such
  dependency is declared) and by ESLint's `@typescript-eslint/no-explicit-any`
  plus code review; a future PR may add an automated dependency-boundary
  lint rule once real domain modules exist to protect.
- `packages/ui` depends on `react` only (peer dependency).
- `apps/*` may depend on `packages/*`; `packages/*` must never depend on
  `apps/*`.
- No package-to-package circular dependencies exist in PR-01 (verified by
  `pnpm install` resolving the workspace graph and `turbo run build`
  succeeding, which fails on cycles).

## Controller/Domain separation

`apps/api`'s only controller (`AppController`) returns static development
info and contains no business logic, establishing the rule that all future
controllers delegate to application/domain services rather than
implementing logic inline.

## TypeScript configuration decisions

- `strict: true`, `noUncheckedIndexedAccess: true` are enabled repo-wide via
  `tsconfig.base.json`.
- `any` and `@ts-ignore` are disallowed via ESLint
  (`@typescript-eslint/no-explicit-any`, `@typescript-eslint/ban-ts-comment`).
- **`exactOptionalPropertyTypes` was evaluated and NOT adopted in PR-01.**
  Rationale: several ecosystem libraries used here (React's JSX prop types,
  NestJS decorators, Zod's `.optional()` output) are not uniformly written
  against `exactOptionalPropertyTypes`, and adopting it now would require
  workarounds throughout `apps/admin-web`, `apps/liff-web`, and `apps/api`
  that add noise without a concrete PR-01 benefit. This is a revisit point,
  not a blocker — see `docs/OPEN_QUESTIONS_PR01.md`.
- Per-package `tsconfig.json` inheritance (extending `tsconfig.base.json`)
  is used rather than full TypeScript project references, per the master
  plan's "Project Reference **or** per-package tsconfig inheritance"
  instruction (section 11.4-E).
- `apps/api` and `apps/worker` override `module`/`moduleResolution` to
  `NodeNext` because they run directly under Node (no bundler); the browser
  apps and packages use the repo default `Bundler` resolution.

## Module resolution / package build model

Internal packages compile with `tsc` to `dist/` (declared via `main`/`types`/
`exports` in each `package.json`) rather than being consumed as raw
TypeScript source. Turborepo's `build`/`dev`/`typecheck`/`test` tasks all
declare `dependsOn: ["^build"]`, so a package's `dist` output is always
rebuilt before a dependent app runs. When actively developing a package,
run its own `dev` script (`tsc --watch`) alongside the consuming app's `dev`
script — `pnpm dev` at the root runs every workspace's `dev` script
concurrently via Turborepo.

## CI

`.github/workflows/ci.yml` runs the minimal gate required by PR-01:
install (frozen lockfile) → format:check → lint → typecheck → test → build.
A more complete CI (OpenAPI contract checks, Playwright, secret scanning) is
introduced in PR-06.
