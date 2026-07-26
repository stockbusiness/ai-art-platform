# @ai-art-platform/config

Environment variable loading and validation shared across apps.

## Responsibility

- Defines Zod schemas for process environment variables.
- Fails fast with a readable error when required variables are missing or
  invalid, instead of letting an app boot with silently-wrong configuration.

## PR-01 scope

Only `NODE_ENV` and `LOG_LEVEL` are validated. Database, LINE, Stripe, and
image-generation provider variables are intentionally out of scope and will
be added by the PRs that introduce those integrations.

## Non-goals

- No secret storage or retrieval (Secret Manager integration is a later PR).
- No tenant-specific configuration.
