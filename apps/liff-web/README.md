# liff-web

LIFF / end-user web shell (React + TypeScript + Vite).

## Responsibility

- Renders the LIFF application shell and router: `/`, `/auth/callback`,
  `/maintenance`.

## PR-01 scope

Router skeleton only. **No LINE SDK connection** — `/auth/callback` is a
placeholder. Real ID Token exchange and tenant resolution are Phase 2 work
(see the master plan, section 5.1 and 8.1).

## Local development

```bash
pnpm --filter @ai-art-platform/liff-web dev
```

Served at http://localhost:5174 by default.
