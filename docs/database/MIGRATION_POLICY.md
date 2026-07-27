# Migration Policy — PR-02

## Source of truth

`prisma/schema.prisma` (repo root) is the source of truth for the schema.
All schema changes go through `prisma migrate dev` (locally, to generate a
new migration) followed by committing the generated
`prisma/migrations/<timestamp>_<name>/migration.sql`. The application
never issues `CREATE TABLE`, `ALTER TABLE`, or other DDL at request time —
`Prisma Migrate` is the only path.

## Partial/complex constraints

Prisma's schema language cannot express every PostgreSQL constraint (for
example, a partial unique index). When one is needed:

1. Let `prisma migrate dev` generate the migration from the schema as
   normal.
2. Manually add the extra SQL statement(s) to the generated
   `migration.sql`, with a comment explaining why Prisma couldn't express
   it.
3. Verify the constraint actually works with `\d <table>` in `psql` and
   with a repository-level Integration Test that intentionally violates
   it.

PR-02's example: the "at most one Primary Domain per Tenant" rule is a
partial unique index appended by hand to
`prisma/migrations/20260727101006_pr02_tenant_foundation/migration.sql`
(see `docs/database/ER_DIAGRAM_PR02.md`).

## Direct vs. pooled connections

`prisma migrate dev`/`deploy` use `DATABASE_DIRECT_URL`; the running API
uses `DATABASE_URL`, which may point at a connection pooler in
staging/production. Migrations must never run through a pooler.

## Environments

| Environment                | Applies migrations?    | How                                                                                                                      |
| -------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Local development          | Yes                    | `pnpm db:migrate:dev` against the `compose.yaml` Postgres.                                                               |
| CI (`database` job)        | Yes                    | `pnpm db:migrate:deploy` against a throwaway GitHub Actions Postgres service container, destroyed at the end of the job. |
| Staging Supabase           | **Not in PR-02**       | Deferred — connection info and an execution owner are not yet decided (`OPEN_QUESTIONS_PR02.md`).                        |
| Production / legacy PHP DB | **Never from this PR** | Out of scope entirely; PR-02 never connects to either.                                                                   |

## Required checks before a migration is considered safe to merge

- Applies cleanly to a genuinely empty database (verified in PR-02 both
  locally and via the `database` CI job).
- A second `migrate deploy` against the same, already-migrated database is
  a no-op ("No pending migrations to apply") — verified locally by running
  it twice in a row.
- The seed (`pnpm db:seed`) is idempotent — running it twice yields one
  `tenants` row for `tenant_key = 'default'`, not two.
- No `continue-on-error` on the CI step that runs `db:migrate:deploy`; a
  failed migration fails the build.

## No automatic Down migrations

Prisma does not generate down migrations. `ROLLBACK_PROCEDURE_PR02.md`
documents the manual rollback approach (pre-merge: delete the branch;
post-merge/pre-staging: `git revert`; post-staging-apply: backup +
reviewed rollback SQL — not applicable yet since PR-02 never applies to
staging).
