# @ai-art-platform/api-contracts

Shared Zod schemas for the `/api/v1` HTTP contract, consumed by both
`apps/api` and the browser apps so client and server never drift.

## PR-01 scope

Only the common `ApiErrorResponse` envelope is defined. No business DTOs
(Tenant, User, Reservation, ...) are introduced yet — those arrive with the
PRs that implement each module, alongside a fixed error-code registry.

## Non-goals

- No OpenAPI generation yet (PR-06).
- No runtime HTTP client.
