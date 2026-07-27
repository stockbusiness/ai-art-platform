# Tenant Policy — PR-02

Fixes the remaining PR-02-前提Blocker decisions
(`AI_ART_PLATFORM_PR02_DATABASE_TENANT_INSTRUCTIONS.md` section 2.3-2.5)
that are policy/documentation only in PR-02 — no Admin, User, or LINE
tables exist yet.

## Tenant ↔ LINE Channel

Data model (future PR, not implemented in PR-02):

```text
Tenant 1 : N LINE Channel Connection
```

- MVP operational rule: at most one **Primary** Channel may be active per
  Tenant at a time (this is the one constraint PR-02 actually implements —
  see `TenantDomain.isPrimary`, which models the same "at most one primary
  per tenant" shape for domains; the LINE Channel table itself does not
  exist yet).
- The 1:N shape exists so a future PR can add, without a schema
  redesign:
  - Channel switch history (old Channels kept, marked inactive)
  - Additional Channels for different LIFF use cases under the same Tenant
  - Per-OEM Channels
  - Verification/staging Channels
- PR-02 implements no LINE Channel table and stores no LINE secrets.

## Users are per-Tenant rows, not shared rows

- A person who belongs to Tenant A and Tenant B has two separate
  `users` rows (two separate `users.id` values), not one shared row.
- They are correlated only via `common_user_id` (see `ID_POLICY.md`) —
  never automatically merged.
- The following are never automatically shared across a person's
  Tenant memberships:
  - membership tier
  - entitlements
  - reservations
  - attendance
  - generation quota
  - staff notes
  - suspension state
  - assigned agency contact
- Cross-Tenant reads are forbidden except through an explicit, future
  head-office ("本部") feature — no generic cross-Tenant repository method
  is to be added casually in later PRs.
- PR-02 implements no Users table; this section fixes the shape for PR-03.

## Admin role names

Fixed enum (PR-03 will implement the Admin table/auth against this; PR-02
implements neither):

```text
SUPER_ADMIN
TENANT_OWNER
TENANT_ADMIN
STAFF
VIEWER
```

| Role           | Scope                                                      |
| -------------- | ---------------------------------------------------------- |
| `SUPER_ADMIN`  | All Tenants. `tenant_id` may be NULL.                      |
| `TENANT_OWNER` | Single Tenant, highest authority within it.                |
| `TENANT_ADMIN` | Tenant configuration/operations management.                |
| `STAFF`        | Day-to-day operations (classes, reservations, attendance). |
| `VIEWER`       | Read-only.                                                 |

Every role except `SUPER_ADMIN` requires a non-null `tenant_id`.

## Tenant isolation rules PR-02 does implement

- `TenantKey` (`packages/domain/src/tenant/tenant-key.ts`) validates format
  in the domain layer; the DB additionally enforces it via a `UNIQUE`
  constraint, `VARCHAR(50)`, and a `CHECK` constraint
  (`tenants_tenant_key_format_check`) mirroring the same regex — three
  layers, not just one, so a raw SQL write bypassing the domain layer
  still cannot store an invalid tenant_key.
- `Tenant.tenantKey` is set once at creation and has no `rename` path in
  the domain entity or the repository — it is immutable after creation.
- `Tenant.name` is validated by `assertValidTenantName()` in both
  `Tenant.create()` and `Tenant.rename()`: 1–120 characters, rejecting an
  empty string and a whitespace-only string. The DB additionally enforces
  the non-blank rule via a `CHECK` constraint
  (`tenants_name_not_blank_check`) and the upper bound via the
  `VARCHAR(120)` column type.
- `TenantDomain.host` is never accepted as a raw string by the
  `TenantRepository` port — `addTenantDomain`'s `CreateTenantDomainInput.host`
  is typed as `TenantDomainHost`
  (`packages/domain/src/tenant/tenant-domain-host.ts`), a Value Object
  whose only constructor is `TenantDomainHost.create()`. It normalizes to
  lowercase and rejects an empty string, a scheme (`://`), a path (`/`), a
  port (`:port`), and anything that isn't a bare multi-label hostname; two
  hosts differing only by case are treated as equal via `.equals()`. This
  means a caller cannot reach the Repository with an unvalidated host —
  the type system forces `TenantDomainHost.create()` to run first. The DB
  additionally enforces the same shape via a `CHECK` constraint
  (`tenant_domains_host_format_check`), so a raw SQL write bypassing the
  domain layer still cannot store an invalid or non-normalized host. Note
  that the DB's `UNIQUE` constraint on `host` is itself case-sensitive —
  the case-insensitive uniqueness guarantee comes from
  `TenantDomainHost.create()` always lowercasing before the value reaches
  the Repository, combined with the CHECK constraint rejecting uppercase
  outright.
- Repository methods that will operate on Tenant-scoped data in later PRs
  should require `tenantId` as an explicit parameter (not inferred from
  ambient context), so a caller can't accidentally query across Tenants.
  PR-02 has no Tenant-scoped child data to enforce this against yet beyond
  `TenantDomain`/`TenantSetting`, which already take `tenantId` explicitly
  in every `TenantRepository` method (see `packages/domain/src/tenant/tenant-repository.ts`).
- A raw `tenantKey` string received from a client (e.g. from a `Host`
  header or a path parameter) is never treated as an authenticated Tenant
  context by itself — `ResolvePublicTenantByKeyUseCase` only returns
  public, non-sensitive fields, and PR-02 exposes no endpoint that uses a
  client-supplied Tenant identity for authorization decisions.
