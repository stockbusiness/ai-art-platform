# @ai-art-platform/logger

Structured logging (Pino) with secret redaction shared across apps.

## Responsibility

- Provides `createLogger`, a thin wrapper over Pino with a fixed redaction
  policy applied to every logger instance.
- Redacts `password`, `token`, `authorization`, and `cookie` fields (top-level
  and nested up to 3 levels) so secrets never reach log output.

## Non-goals

- No log shipping/transport configuration (left to infrastructure).
- No request-scoped correlation ID / request ID helpers yet (Phase 1 PR-06
  introduces structured audit + request tracing).
