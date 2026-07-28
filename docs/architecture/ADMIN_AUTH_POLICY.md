# Admin Authentication Policy — PR-03A

Fixes the authentication/session/RBAC foundation decisions from
`AI_ART_PLATFORM_PR03A_ADMIN_AUTH_RBAC_INSTRUCTIONS.md`. This document
covers _authentication_; see `RBAC_POLICY.md` for the Permission Matrix
and `docs/security/SESSION_COOKIE_CSRF_POLICY.md` for Cookie/CSRF
mechanics.

## Email identity rules (section 3.1)

- Always normalized (`trim().toLowerCase()`) before storage or lookup —
  `packages/domain/src/admin-auth/admin-email.ts`'s `AdminEmail.create()`
  is the only way to construct one.
- Tenant-scoped admins: unique per `(tenant_id, email)`.
- `SUPER_ADMIN`: unique per `email` globally (`tenant_id IS NULL`).
- The same email may exist as a Tenant admin in Tenant A, a Tenant admin
  in Tenant B, and a `SUPER_ADMIN` row simultaneously — login
  disambiguates purely by whether `tenantKey` is present in the request
  (see below), never by trying one lookup and falling back to the other.

## Login request shape (section 3.2)

```text
POST /api/v1/admin/auth/login

Tenant-scoped admin: { "tenantKey": "...", "email": "...", "password": "..." }
SUPER_ADMIN:          { "email": "...", "password": "..." }
```

- `tenantKey` present → only a Tenant-scoped admin lookup is attempted
  (`AdminUserRepository.findByTenantAndEmail`).
- `tenantKey` absent → only a `SUPER_ADMIN` lookup is attempted
  (`AdminUserRepository.findSuperAdminByEmail`, `role = 'SUPER_ADMIN'`
  and `tenant_id IS NULL`).
- Neither path ever falls back to the other, even if the "wrong" kind of
  account exists with that email — verified by
  `apps/api/test/integration/admin-auth-api.integration.spec.ts`
  ("tenantKey omitted for a Tenant-scoped admin" / "tenantKey present
  for a SUPER_ADMIN email").
- A suspended Tenant blocks its own admins from logging in, reported
  identically to every other failure (see below).
- The external response never distinguishes: unknown user, unknown
  Tenant, wrong password, suspended Tenant, or disabled account. All of
  them throw `AdminAuthenticationFailedError` → `401
AUTHENTICATION_FAILED`. The specific reason is recorded server-side
  only, in `admin_login_events.failure_reason` — see
  `DATABASE_SCHEMA_PR03A.md`.

## Password Policy (section 3.3)

Enforced by `packages/domain/src/admin-auth/password-policy.ts`'s
`validateAdminPassword(password, email)`:

- 12–128 characters.
- Not whitespace-only.
- Not identical to the admin's own (normalized) email.
- Never trimmed before validation or hashing — a password consisting of
  meaningful characters padded with leading/trailing whitespace is
  validated and hashed exactly as submitted.

Hashing: **Argon2id** (`apps/api/src/modules/admin-auth/infrastructure/
argon2-password-hasher.ts`, via the `argon2` package, `type:
argon2.argon2id` set explicitly rather than relying on the library's
default). The plaintext password never reaches the Domain layer as a
long-lived object — `validateAdminPassword` is a pure function, not a
value object that could accidentally be logged or serialized.

## Session model (section 3.4)

DB-backed Opaque Session — deliberately **not** JWT. See
`docs/security/SESSION_COOKIE_CSRF_POLICY.md` for the full Cookie/Token
mechanics. In short: a cryptographically random token is set on an
HttpOnly Cookie; only its SHA-256 hash is ever persisted
(`admin_sessions.token_hash`).

## Account Lockout and IP-level rate limiting (section 3.5)

- **Account lockout**: `AdminUser.recordFailedLogin()` increments a
  per-admin consecutive-failure counter
  (`admin_users.failed_login_count`); once it reaches
  `ADMIN_LOGIN_ACCOUNT_MAX_FAILURES` (default 5), `locked_until` is set
  to `now + ADMIN_LOCKOUT_SECONDS` (default 900s / 15 minutes). A
  successful login (`recordSuccessfulLogin()`) resets the counter to 0
  and clears `locked_until`. While locked, the entity is rejected
  _before_ password verification even runs — a correct password during
  the lockout window is still rejected.
- **IP-level rate limiting**: independent of any specific account.
  `LoginAdminUseCase` counts recent failed `admin_login_events` rows for
  the request's `ip_hash` within the last `ADMIN_LOGIN_WINDOW_SECONDS`
  (default 900s); once that count reaches
  `ADMIN_LOGIN_IP_MAX_FAILURES` (default 20), further attempts from that
  IP are rejected — checked _before_ any tenant/email lookup, so it also
  throttles attempts against unknown emails.
- Both cases report `429 TOO_MANY_ATTEMPTS` — distinct from the `401
AUTHENTICATION_FAILED` used for ordinary credential failures — but
  never reveal which mechanism triggered, nor a remaining-attempts
  count, nor the lockout expiry time.
- IP addresses and User-Agents are never stored in plaintext — see
  "Hashing" below.
- **Atomicity under concurrency (review-fix P0-3/P0-4)**: the account
  failure counter is updated via
  `AdminUserRepository.recordFailedLoginAtomically()` — a single SQL
  `UPDATE admin_users SET failed_login_count = failed_login_count + 1,
locked_until = CASE WHEN ... RETURNING ...` statement, not a
  read-then-write via `update()`. Postgres's row-level locking on that
  UPDATE means concurrent failed attempts against the same admin can
  never lose an increment. The IP-level check is additionally serialized
  per IP hash via `pg_advisory_xact_lock` (P0-4,
  `AdminLoginEventRepository.acquireIpRateLimitLock()`), held for the
  whole login-attempt transaction, so the "count, then decide, then
  record" sequence for one IP can never race with another attempt from
  the same IP — a different IP is never blocked by it. Verified by
  concurrent-attempt integration tests in
  `admin-auth-api.integration.spec.ts` (`TEST_RESULTS_PR03A.md`).
  **Known limitation**: an extreme, fully-simultaneous burst from one IP
  (dozens of requests within milliseconds) can still exhaust the
  default Prisma connection pool (`num_cpus * 2 + 1`) while requests
  queue behind the advisory lock, surfacing as `503
AUTH_SERVICE_UNAVAILABLE` for the requests that time out rather than a
  correct 401/429 — see `OPEN_QUESTIONS_PR03A.md` for the sizing
  tradeoff and recommended follow-up (raise `connection_limit` and/or
  move Argon2 verification out of the lock-holding transaction).
- **Timing equalization for the dummy-verify paths (review-fix P0-2)**:
  before section 3.5's PR-03A baseline, the 401 paths that never reach a
  real `AdminUser` (unknown email, missing/suspended Tenant, unknown
  admin, DISABLED admin) skipped Argon2 verification entirely, while a
  wrong-password attempt against a real admin always ran a real verify
  — a measurable timing difference an attacker could use to distinguish
  "this email doesn't exist" from "this email exists but the password is
  wrong," partially defeating the generic-401 design goal. Those four
  branches now call `PasswordHasher.verifyDummy(password)`
  (`Argon2PasswordHasher`, `apps/api/src/modules/admin-auth/
infrastructure/argon2-password-hasher.ts`), which runs a real Argon2id
  verify against a fixed dummy hash (computed lazily on first use, never
  a real admin's hash) before returning 401 — bringing that branch's
  cost close to the real-mismatch branch's. Lockout/IP-rate-limited 429
  paths still skip both real and dummy verify (an intentional
  fast-reject, not a timing leak the design cares about — see
  `AI_ART_PLATFORM_PR03A_REVIEW_FIX_INSTRUCTIONS.md` section 3.2).
  Verified per-branch by `verify()`/`verifyDummy()` call-count
  assertions in `login-admin.use-case.test.ts`.

## Reverse proxy client IP (review-fix P0-5)

`ADMIN_TRUST_PROXY_HOPS` (see `packages/config/src/env.ts`) controls
Express's `trust proxy` setting, wired in `configureApp()`
(`apps/api/src/bootstrap/configure-app.ts`). Unset in development/test
(defaults to `0` — trust nothing, use the raw socket address);
`NODE_ENV=production` requires it to be set explicitly (schema-level
`superRefine`, fails app boot otherwise) — never an unconditional
`true`, which would let a client forge its own `X-Forwarded-For` to
bypass IP-level rate limiting entirely. `LoginAdminUseCase` never reads
`X-Forwarded-For` itself; it only ever sees whatever `req.ip` Express
already resolved according to this setting.

## Request ID correlation (review-fix P0-6)

`requestIdMiddleware` (`apps/api/src/infrastructure/http/request-id.ts`)
generates exactly one server-side UUID per request — before any Guard,
UseCase, or Controller runs — and attaches it to the request, echoes it
as the `X-Request-ID` response header, and threads it into
`LoginAdminUseCase` and every `mapAdminAuthErrorToHttp()` call site (all
four Guards plus the Controller). The result: a client-visible
`error.requestId` always matches the exact `admin_login_events.request_id`
row the same attempt wrote, letting an operator correlate a reported
failure with its server-side audit trail. An incoming `X-Request-ID`
header from the client is never trusted as the correlation ID.

## Infrastructure failures are never reported as unauthenticated (review-fix P0-7)

`mapAdminAuthErrorToHttp()`'s fallback branch — previously mapping any
error that wasn't one of the four known Domain errors to `401
UNAUTHENTICATED` — now maps to `503 AUTH_SERVICE_UNAVAILABLE`. A DB
outage, a Prisma error, or a failed transaction is a service problem,
not evidence the caller isn't authenticated; conflating the two would
make a real outage invisible in monitoring built around 401 rates, and
would be actively misleading to an admin who has a perfectly valid
session. No internal detail (SQL, host, stack trace) is included in the
response body regardless. Verified end-to-end (DB genuinely
unreachable) for `POST /login`, `GET /me`, plus the pre-existing
`GET /health` (still 200) / `GET /ready` (still 503) behavior in
`db-down.integration.spec.ts`.

## Hashing of IP / User-Agent / Email in the audit log (sections 3.5/4.4)

`apps/api/src/modules/admin-auth/infrastructure/request-fingerprint.ts`'s
`hashWithSecret(value, secret)` computes HMAC-SHA256 keyed by
`AUTH_IP_HASH_SECRET` (a required, ≥16-character server-only environment
variable — see `packages/config/src/env.ts`'s `apiEnvSchema`). Used for:

- `admin_sessions.ip_hash` / `admin_sessions.user_agent_hash`
- `admin_login_events.ip_hash` / `admin_login_events.user_agent_hash` /
  `admin_login_events.email_hash`

A keyed HMAC (not a bare SHA-256) means these hashes cannot be reversed
by brute-force dictionary lookup from a DB dump alone — the attacker
would also need `AUTH_IP_HASH_SECRET`, which is excluded from
`packages/logger`'s redaction-safe defaults and never sent to a browser
app.

## Login transaction boundary (review-fix P1-1)

The entire body of one login attempt — IP lock acquisition, the count
check, the eventual atomic admin-state update (failed-count increment or
success reset), session creation, and the `admin_login_events` write —
runs inside a single DB transaction via `DbTransactionPort`
(`apps/api/src/modules/admin-auth/domain-services/db-transaction.port.ts`,
implemented by `PrismaDbTransactionService` using
`PrismaClient.$transaction()`). Because _expected_ outcomes (401/429)
must still commit their audit-log row even though the use case ends by
"failing," `LoginAdminUseCase` returns a `{kind: "success"|"failure"}`
discriminated result from inside the transaction callback instead of
throwing — throwing inside the callback would roll back the very
write that outcome needs persisted. Only a genuinely unexpected error
(thrown by a repository call itself, e.g. a DB error) propagates as a
real exception, rolling back everything from that attempt — verified by
a fault-injection integration test that makes `AdminSessionRepository
.create()` throw partway through a successful-credentials login and
asserts the atomic admin-state reset was _not_ persisted despite having
already run before the throw (`admin-auth-api.integration.spec.ts`,
"Login transaction integrity"). The Domain layer and Controllers stay
Prisma-free — repository methods accept an opaque `DbTransactionHandle`
(`unknown` in the Domain layer's type) that only the Prisma-backed
infrastructure adapters know how to use.

## Bootstrap (section 11)

See `docs/development/ADMIN_BOOTSTRAP.md` for the `pnpm admin:bootstrap`
CLI. No default/seeded Admin password exists anywhere in the codebase —
`prisma/seed.ts` remains Tenant-only, matching PR-02.

## What this PR does not implement (section 7.4/12/15)

Password Reset, Password Change, Forgot Password, MFA, Admin
Create/Update/Delete HTTP APIs, a Session list, forced logout of other
Sessions, general User authentication, LINE Login, and any
`apps/admin-web` real login screen or protected shell (PR-03B). See
`OPEN_QUESTIONS_PR03A.md` for what's explicitly deferred and why.
