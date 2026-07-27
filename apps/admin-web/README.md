# admin-web

Admin console (React + TypeScript + Vite).

## Responsibility

- Renders the admin application shell and router.
- Shows the app name and build version so a running deployment can be
  identified at a glance.

## PR-01 scope

Only a shell + router skeleton. No authentication, no data fetching, no
business screens (see the master plan's `/tenants`, `/users`, `/classes`,
... list for what comes later).

## Local development

```bash
pnpm --filter @ai-art-platform/admin-web dev
```

Served at http://localhost:5173 by default.
