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
