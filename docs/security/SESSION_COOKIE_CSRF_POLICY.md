# Session, Cookie and CSRF Policy — PR-03A

Fixes the mechanics decisions from
`AI_ART_PLATFORM_PR03A_ADMIN_AUTH_RBAC_INSTRUCTIONS.md` section 3.4.

## Why Opaque Session Tokens, not JWT

A DB-backed Opaque Session was chosen deliberately over a JWT (section
3.4 makes this explicit: "JWTではなく、DB保存型のOpaque Sessionを採用
する"). This means every authenticated request costs one extra DB
lookup (`admin_sessions.token_hash`), but in exchange:

- A Session can be revoked instantly and unconditionally (Logout,
  future forced-logout features) — a JWT can't be invalidated before
  its own expiry without a separate revocation-list mechanism anyway,
  which would have made the "DB-backed" property true either way.
- No signing-key rotation/rollover concerns.
- The server is always the single source of truth for what's currently
  valid — there is no way for a Session to "look valid" to the server
  while actually representing stale data, since every request re-reads
  the current row.

## Token generation and hashing

`apps/api/src/modules/admin-auth/infrastructure/
crypto-session-token.service.ts` (`CryptoSessionTokenService`,
implementing the `SessionTokenPort` in `domain-services/`):

- Raw token: `crypto.randomBytes(32)` (32 bytes = 256 bits of entropy,
  meeting the "cryptographically random, ≥32 bytes" requirement),
  base64url-encoded.
- Persisted form: SHA-256 hex digest of the raw token
  (`admin_sessions.token_hash`, `VARCHAR(64)`, `UNIQUE`).
- The raw token is **never** persisted anywhere — it exists only as the
  value set on the Session Cookie and, transiently, in the HTTP response
  that creates it.
- The exact same mechanism (same service, same `hash()` method) is
  reused for the CSRF Token (`csrf_token_hash`) — both are opaque random
  tokens whose only persisted form is a hash; there is no cryptographic
  reason to use a different algorithm for one vs. the other.

## Cookies (section 3.4)

| Cookie name            | HttpOnly | Secure                                           | SameSite | Path | Max-Age                                  |
| ---------------------- | :------: | ------------------------------------------------ | :------: | :--: | ---------------------------------------- |
| `ai_art_admin_session` |  `true`  | `true` in production, may be `false` in dev/test |  `Lax`   | `/`  | `ADMIN_SESSION_TTL_SECONDS` (8h default) |
| `ai_art_admin_csrf`    | `false`  | same rule as above                               |  `Lax`   | `/`  | same as Session Cookie                   |

Implemented in `apps/api/src/modules/admin-auth/presentation/
session-cookies.ts`. `sessionCookieOptionsFor(env)` derives `secure`
purely from `env.NODE_ENV === "production"` — no separate flag exists,
so a misconfigured `NODE_ENV` in a real deployment would be the only way
to accidentally ship a non-Secure cookie, which is the same class of
risk PR-02 already accepts for other environment-driven behavior.

Both Cookies are set together on a successful `POST /login`
(`setSessionCookies`) and cleared together on `POST /logout`
(`clearSessionCookies`) — there is no code path that sets one without
the other.

## Session lifetime (section 3.4)

- **Absolute expiry**: fixed at issuance —
  `admin_sessions.expires_at = createdAt + ADMIN_SESSION_TTL_SECONDS`.
  There is no sliding/rolling absolute expiry; `AdminSession.isExpired()`
  is a pure comparison against this fixed timestamp.
- **`last_seen_at` throttled update**: `AuthenticateSessionUseCase`
  calls `session.shouldTouch(now, 300)` (5 minutes, hardcoded — not
  env-configurable, since section 10 lists no such variable) before
  writing `last_seen_at`, so a burst of requests from an active admin
  does not turn into a DB write per request.
- **No refresh/extend endpoint** (explicitly out of scope — section
  3.4: "今回Refresh Token／Session延長Endpointは作らない。再ログインで
  新しいSessionを発行する"). When a Session expires, the admin must log
  in again; there is no silent renewal.
- **Expired or revoked → rejected**: `AdminSession.isValid(now)` is
  `!isExpired(now) && !isRevoked()`. `AdminAuthGuard` treats both cases
  identically as `401 UNAUTHENTICATED` — the external response never
  distinguishes "expired" from "revoked" from "never existed".

## CSRF (section 3.4)

- A distinct CSRF token is generated per Session (not derived from the
  Session token) at login time, alongside it.
- The browser reads the (non-HttpOnly) `ai_art_admin_csrf` Cookie via
  JavaScript and echoes its value back as the `X-CSRF-Token` request
  header on state-changing requests — this is the standard
  double-submit-cookie pattern, strengthened here by also comparing
  against a server-side hash (see below), not just Cookie == Header.
- `CsrfGuard` (`apps/api/src/modules/admin-auth/presentation/
csrf.guard.ts`) verifies, in order: (1) both the Cookie and Header are
  present and non-empty; (2) the Cookie value equals the Header value;
  (3) `hash(cookieValue) === authenticatedContext.csrfTokenHash` (the
  hash already loaded by `AdminAuthGuard` from `admin_sessions`, so no
  extra DB round-trip). All three must hold — this is a _three-way_
  match (Cookie, Header, DB-stored hash), not merely a Cookie/Header
  comparison, so an attacker who could somehow control both the Cookie
  and the Header (e.g. a same-site subdomain takeover) still could not
  forge a value matching a Session they don't own.
- **`GET`/`HEAD`/`OPTIONS` never require CSRF** (section 3.4) — `GET
/me` has no `CsrfGuard` applied.
- **`POST /login` never requires CSRF** (section 3.4) — there is no
  Session yet to protect at that point; the endpoint's own generic
  failure responses and rate limiting are its defense.
- **`POST /logout` always requires CSRF** (section 3.4) —
  `@UseGuards(AdminAuthGuard, CsrfGuard)`.

## Logout and idempotency (section 7.3)

`POST /logout` revokes the Session (`admin_sessions.revoked_at` +
`revoke_reason = "USER_LOGOUT"`) and clears both Cookies, returning `204
No Content`.

**Design decision on repeat Logout calls**: `AdminSession.revoke()`
itself is idempotent (a second call on an already-revoked session is a
silent no-op, not an error), and `LogoutAdminUseCase` treats an
unresolvable token as "already logged out" rather than an error.
However, because `AdminAuthGuard` runs _before_ the Controller on every
protected route — including `/logout` — a second Logout request
carrying the _same_ Cookie will be rejected by the Guard itself with
`401 UNAUTHENTICATED`, since the Session it refers to is by then
revoked-and-therefore-invalid. This satisfies "同一Logout再送は安全に
処理する" under the interpretation "does not crash, does not leak
information, produces a well-defined error" — see
`OPEN_QUESTIONS_PR03A.md` item 1 for the full reasoning and the
alternative interpretation this would require if wrong. Verified by
`admin-auth-api.integration.spec.ts`'s "a second logout with the same
(now-revoked) cookie fails safely with 401, not a 500".

## What never appears in a client-facing response or log

- The raw Session Token or CSRF Token, except as the Cookie value at the
  moment they're issued (never echoed back in a JSON body, never logged
  — `packages/logger`'s `SENSITIVE_KEYS` redacts `token`/`cookie`
  generically).
- `password_hash`.
- `AUTH_IP_HASH_SECRET` (`packages/logger`'s `SENSITIVE_KEYS` now
  includes `authIpHashSecret`/`AUTH_IP_HASH_SECRET` explicitly).
- The specific `AdminLoginFailureReason` behind a login failure (see
  `ADMIN_AUTH_POLICY.md`).
