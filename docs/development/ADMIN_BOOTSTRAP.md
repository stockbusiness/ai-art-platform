# Admin Bootstrap CLI — PR-03A

Fixes the Bootstrap CLI decisions from
`AI_ART_PLATFORM_PR03A_ADMIN_AUTH_RBAC_INSTRUCTIONS.md` section 11.

## Why a separate CLI, not part of `prisma/seed.ts`

`prisma/seed.ts` (PR-02) is idempotent, safe to run in CI, and creates
no secrets — it only upserts the `default` Tenant. A Bootstrap CLI that
creates the _first_ Admin necessarily handles a real password, so it is
deliberately kept out of the automatic seed path: nothing runs it
without an operator explicitly invoking it with explicit credentials.

## Usage

```bash
BOOTSTRAP_ADMIN_EMAIL=root@example.com \
BOOTSTRAP_ADMIN_PASSWORD='a-real-password-at-least-12-chars' \
BOOTSTRAP_ADMIN_NAME='Root Admin' \
BOOTSTRAP_ADMIN_ROLE=SUPER_ADMIN \
pnpm admin:bootstrap
```

For a Tenant-scoped admin, add `BOOTSTRAP_TENANT_KEY`:

```bash
BOOTSTRAP_ADMIN_EMAIL=owner@example.com \
BOOTSTRAP_ADMIN_PASSWORD='a-real-password-at-least-12-chars' \
BOOTSTRAP_ADMIN_NAME='Tenant Owner' \
BOOTSTRAP_ADMIN_ROLE=TENANT_OWNER \
BOOTSTRAP_TENANT_KEY=default \
pnpm admin:bootstrap
```

Runs `prisma/admin-bootstrap.ts` via `tsx`, after building
`@ai-art-platform/database` and `@ai-art-platform/domain` (same pattern
as `pnpm db:seed`'s dependency on `@ai-art-platform/database`).

## Environment variables

| Variable                   |  Required   | Notes                                                                                                              |
| -------------------------- | :---------: | ------------------------------------------------------------------------------------------------------------------ |
| `BOOTSTRAP_ADMIN_EMAIL`    |     yes     | Validated by `AdminEmail.create()` — normalized before storage.                                                    |
| `BOOTSTRAP_ADMIN_PASSWORD` |     yes     | Validated by `validateAdminPassword()` — 12–128 chars, not blank, not equal to the email. Never printed or logged. |
| `BOOTSTRAP_ADMIN_NAME`     |     yes     | Validated by `AdminName.create()` — 1–120 chars.                                                                   |
| `BOOTSTRAP_ADMIN_ROLE`     |     yes     | One of `SUPER_ADMIN`/`TENANT_OWNER`/`TENANT_ADMIN`/`STAFF`/`VIEWER`.                                               |
| `BOOTSTRAP_TENANT_KEY`     | conditional | **Forbidden** when role is `SUPER_ADMIN`; **required** for every other role.                                       |

Also requires `DATABASE_URL`/`DATABASE_DIRECT_URL` (same as every other
`pnpm db:*` script) — points at whichever Postgres the CLI should write
into.

## Validation rules (all enforced before any DB write)

- `SUPER_ADMIN` + `BOOTSTRAP_TENANT_KEY` set → fails:
  `"BOOTSTRAP_TENANT_KEY must not be set when
BOOTSTRAP_ADMIN_ROLE=SUPER_ADMIN"`.
- Non-`SUPER_ADMIN` role + `BOOTSTRAP_TENANT_KEY` unset → fails:
  `"BOOTSTRAP_TENANT_KEY is required when BOOTSTRAP_ADMIN_ROLE=<role>"`.
- `BOOTSTRAP_TENANT_KEY` referencing a Tenant that doesn't exist →
  fails: `'Tenant "<key>" was not found'`.
- `BOOTSTRAP_TENANT_KEY` referencing a `SUSPENDED` Tenant → fails:
  `'Tenant "<key>" is not ACTIVE'`.
- A duplicate Admin (same `(tenant_id, email)`, or same email among
  `SUPER_ADMIN` rows) → fails with a message naming the conflict, no DB
  write occurs (verified as a real `UNIQUE`-index violation, not just an
  application-level pre-check, by re-running the CLI with identical
  arguments in `TEST_RESULTS_PR03A.md`'s Migration Test section).
- Password/Email/Name failing their Domain-layer validation → fails
  with the corresponding `InvalidAdmin*Error` message.

All failures exit with a non-zero code (`process.exitCode = 1`) and
print only `error.message` — never the password, never the password
hash, never a raw stack trace with request internals.

## Safety properties

- Never run automatically — not part of `prisma/seed.ts`, not part of
  any `pnpm dev`/`pnpm build`/CI Quality job step.
- `pnpm-only`: no HTTP endpoint exists for creating the first Admin —
  this is intentionally an operator-run, out-of-band CLI, matching
  section 11's implicit assumption that there is no self-serve Admin
  signup.
- The password is read once from the environment, validated, hashed
  with Argon2id, and the plaintext value is never written to disk, never
  logged, never included in the success/failure output.

## CI usage (Database job)

`.github/workflows/ci.yml`'s `database` job exercises the CLI twice
against the CI-only ephemeral Postgres service container, after `pnpm
db:seed`:

1. Run once with a fixed test email/password — expect success.
2. Run again with the identical email — expect failure (duplicate
   rejection), asserted via shell (`if pnpm admin:bootstrap; then exit
1; fi`) so a regression that silently _allows_ the duplicate would
   fail the CI job rather than pass unnoticed.

Neither run's credentials are real — they exist only for the duration
of that CI job's disposable database container and are never reused.
