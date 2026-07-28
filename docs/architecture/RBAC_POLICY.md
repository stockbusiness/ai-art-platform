# RBAC Policy — PR-03A

Fixes the Role/Permission/Tenant-boundary decisions from
`AI_ART_PLATFORM_PR03A_ADMIN_AUTH_RBAC_INSTRUCTIONS.md` section 3.6/8/9.
Extends (does not replace) `TENANT_POLICY.md`'s section 2.5 Admin Role
fixture from PR-02.

## Fixed Admin Roles (unchanged from `TENANT_POLICY.md`)

```text
SUPER_ADMIN
TENANT_OWNER
TENANT_ADMIN
STAFF
VIEWER
```

Every role except `SUPER_ADMIN` requires a non-null `tenant_id`.
`SUPER_ADMIN` requires a null `tenant_id`. Enforced in three independent
layers, not just one:

1. `packages/domain/src/admin-auth/admin-user.ts`'s
   `AdminUser.create()` (`assertRoleTenantInvariant`, throws
   `AdminRoleTenantMismatchError`).
2. The DB CHECK constraint `admin_users_role_tenant_check` — a raw
   INSERT bypassing the Domain layer still cannot violate it (verified
   directly in `admin-auth-repository.integration.spec.ts`).
3. `AuthenticateSessionUseCase` (the code behind `AdminAuthGuard`)
   re-checks the invariant defensively on every request before trusting
   a loaded `AdminUser`, even though it should be structurally
   unreachable given (1) and (2).

## Fixed Permission Matrix (section 3.6)

```text
admin:self:read
tenant:read
tenant:update
admin:read
admin:manage
operations:read
operations:write
audit:read
```

| Role           | Permissions                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `SUPER_ADMIN`  | all                                                                                                                                  |
| `TENANT_OWNER` | `admin:self:read`, `tenant:read`, `tenant:update`, `admin:read`, `admin:manage`, `operations:read`, `operations:write`, `audit:read` |
| `TENANT_ADMIN` | `admin:self:read`, `tenant:read`, `tenant:update`, `admin:read`, `operations:read`, `operations:write`, `audit:read`                 |
| `STAFF`        | `admin:self:read`, `tenant:read`, `operations:read`, `operations:write`                                                              |
| `VIEWER`       | `admin:self:read`, `tenant:read`, `operations:read`                                                                                  |

Defined once in `packages/domain/src/admin-auth/role-permission-map.ts`
(`ROLE_PERMISSIONS` + `roleHasPermission()`) — the single source of
truth. A Role→Permission decision is never re-implemented ad hoc inside
a Controller method; every protected route declares its requirement via
`@RequirePermissions(...)` (`apps/api/src/modules/admin-auth/
presentation/permissions.decorator.ts`), enforced by `PermissionGuard`.

`admin:manage` is defined but unused in this PR — no endpoint requires
it yet, since no Admin management API is published (section 3.6: "今回、
`admin:manage`を使用する管理者作成・編集APIは公開しない"). It exists so
a future Admin management API can attach
`@RequirePermissions("admin:manage")` without a domain-layer change.

## Guard pipeline (section 8)

Every protected route composes Guards in this order:

```text
AdminAuthGuard  (mandatory first — resolves Session → AuthenticatedAdminContext)
  ↓
PermissionGuard (if @RequirePermissions declared)
  ↓
CsrfGuard       (only for state-changing routes; not applied to GET /me)
```

`AdminAuthGuard` (`apps/api/src/modules/admin-auth/presentation/
admin-auth.guard.ts`) is the only place a Session Cookie is ever read.
It calls `AuthenticateSessionUseCase`, which performs, in order: Session
lookup by hashed token → validity check (not expired, not revoked) →
Admin lookup → Admin active check → role/tenant invariant re-check →
(if Tenant-scoped) Tenant lookup → Tenant active check → touch
`last_seen_at` if the 5-minute interval has elapsed. Any failure along
this chain throws either `AdminUnauthenticatedError` (→ 401
`UNAUTHENTICATED`) or `AdminForbiddenError` (→ 403 `FORBIDDEN`) — see
`ADMIN_AUTH_POLICY.md` and the Guard's own rejection-table comment for
exactly which condition maps to which.

## Tenant boundary (section 9)

- The **only** trusted source of a Tenant-scoped admin's `tenantId` is
  `AuthenticatedAdminContext.tenantId`, itself derived from
  `admin_users.tenant_id` via the authenticated Session — never from a
  Path parameter, Query string, Header, or Body field the client
  supplied. `GET /me` demonstrates this: passing an arbitrary `tenantId`
  in the query string or an `X-Tenant-Id` header has no effect on the
  response (verified in `admin-auth-api.integration.spec.ts`, "ignores
  a client-supplied tenantId").
- `SUPER_ADMIN` sessions carry `tenantId: null`. This PR implements no
  Tenant-selection mechanism for `SUPER_ADMIN` — a `SUPER_ADMIN` cannot
  access any (currently nonexistent) Tenant-scoped resource endpoint.
  Deferred to a later PR, per section 9: "SUPER_ADMINがTenantを選択する
  仕組みも今回実装しない".
- `AdminTenantGuard` (`apps/api/src/modules/admin-auth/presentation/
tenant.guard.ts`) exists as the reusable enforcement point for future
  Tenant-scoped endpoints: it rejects any caller whose
  `AuthenticatedAdminContext.tenantId` is `null` (i.e. `SUPER_ADMIN`,
  since Tenant selection isn't implemented) with `403 FORBIDDEN`, and —
  by construction — never reads a client-supplied `tenantId` at all. No
  current route applies it, since PR-03A has no Tenant-scoped resource
  endpoint; see `OPEN_QUESTIONS_PR03A.md` item 5.
- Cross-Tenant verification: the same email exists as separate admin
  rows in two different Tenants; logging into each with its own
  `tenantKey` resolves the correct Tenant every time, and a Session from
  one Tenant can never resolve the other's context (see the "Tenant
  boundary" describe block in `admin-auth-api.integration.spec.ts`).

## Relationship to `TENANT_POLICY.md`

`TENANT_POLICY.md`'s "Tenant isolation rules PR-02 does implement"
section already established that a client-supplied raw `tenantKey` is
never treated as an authenticated context by itself. PR-03A extends the
same principle from the _public, unauthenticated_ Tenant Resolve
endpoint to the _authenticated Admin_ surface: authentication upgrades
"a string the client sent" into "a validated Session", but the rule that
only the server-derived value is ever trusted stays identical.
