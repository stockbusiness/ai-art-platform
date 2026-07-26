# @ai-art-platform/domain

Framework-free domain modeling primitives shared by future business modules
(Tenant, User, Class, Reservation, Entitlement, Generation, Integration, ...).

## Responsibility

- Provides generic, business-agnostic building blocks: `Result`, `Entity`,
  `DomainError`.
- Establishes the rule enforced from PR-01 onward: **this package must never
  depend on React, NestJS, Prisma, or any other framework/infrastructure
  library.** Business logic lives here; framework glue lives in `apps/*`.

## PR-01 scope

No business entities (Tenant, User, Class, ...) are implemented yet — see
the master plan's Phase 1 PR split. This PR only establishes the package
boundary and its non-negotiable dependency direction.

## Non-goals

- No persistence, HTTP, or messaging concerns.
- No business rules that have not been confirmed (see
  `docs/OPEN_QUESTIONS_PR01.md`).
