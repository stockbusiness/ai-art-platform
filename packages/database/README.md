# @ai-art-platform/database

Prisma Client generation and sharing for PR-02 (Database and Tenant
Foundation).

## Responsibility

- Generates and re-exports the Prisma Client (`PrismaClient`, `Prisma`
  namespace) from the schema at `prisma/schema.prisma` (repo root).
- Provides `createPrismaClient()`, a plain factory function. Callers own
  the connect/disconnect lifecycle.

## Non-goals

- No business logic, no Tenant state transitions, no validation.
- No Controllers, no HTTP DTOs.
- Not imported by `packages/domain`, which stays framework-free.

## Generated client

`generated/client/` is produced by `pnpm db:generate` (run from the repo
root) and is not committed — see `.gitignore`. Run `pnpm db:generate`
after installing dependencies and whenever `prisma/schema.prisma` changes.
