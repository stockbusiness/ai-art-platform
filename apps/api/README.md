# api

NestJS API foundation.

## Responsibility

- Boots a Nest application and exposes a single `GET /` route returning
  development info (name, version, environment) — nothing else.

## PR-01 scope

No database connection, no business controllers, no auth. Controllers must
never contain business logic (see `docs/ARCHITECTURE.md`); this rule starts
being enforced from this single placeholder controller onward.

## Local development

```bash
pnpm --filter @ai-art-platform/api dev
```

Listens on http://localhost:3000 by default.
