# @ai-art-platform/test-utils

Shared, feature-agnostic test setup helpers.

## Responsibility

- `withEnv`: temporarily override `process.env` for a test, with automatic
  restoration.

## Non-goals

- No feature-specific fixtures (Tenant, User, Class, ...). Those belong in
  the PR that introduces the corresponding module.
