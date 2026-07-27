# ID Policy — PR-02

This document records the two identifier-related decisions fixed by
`AI_ART_PLATFORM_PR02_DATABASE_TENANT_INSTRUCTIONS.md` section 2.1/2.2.
PR-02 does not implement a Users table or an ID-issuance service — this is
policy only, so PR-03+ can implement against a settled contract instead of
re-litigating it.

## `ai_art_member_id` (legacy migration ID)

- Existing PHP-side users keep their existing `ai_art_member_id` unchanged
  when migrated. It is never rewritten.
- New IDs issued by the new system use:

  ```text
  aiart:v2:{tenant_key}:{user_uuid}
  ```

  Example: `aiart:v2:default:550e8400-e29b-41d4-a716-446655440000`

- Rules:
  - Immutable once issued.
  - Case is never normalized/transformed.
  - External systems must treat it as an opaque string — never parse it to
    make business decisions.
  - Both the legacy format and the `aiart:v2:...` format are valid
    simultaneously; there is no migration cutover date after which the old
    format stops being accepted.
- PR-02 implements neither a Users table nor the issuance logic itself —
  this section only fixes the format so PR-03's Users table can be
  designed against it without re-deciding it.

## `common_user_id` (shared-ID system) uniqueness

- The common-ID system treats `common_user_id` as globally unique on its
  own side.
- On the AI Art platform's side, Users are created per-Tenant (see
  `TENANT_POLICY.md`), so the constraint here is:

  ```sql
  UNIQUE (tenant_id, common_user_id) WHERE common_user_id IS NOT NULL
  ```

  There is deliberately **no** standalone `UNIQUE (common_user_id)`
  constraint.

- Reason: the same real person can join multiple Tenants (OEMs) through
  the common-ID system. Each Tenant needs its own independent membership
  state, entitlements, reservations, and history for that person — a
  global uniqueness constraint on `common_user_id` alone would prevent
  that by construction.
- PR-02 does not implement a Users table; this section only fixes the
  constraint shape for PR-03.
