# worker

Standalone background worker process foundation.

## Responsibility

- Boots, logs a startup line (never secrets — only `NODE_ENV`), and exits
  cleanly on `SIGINT`/`SIGTERM`.

## PR-01 scope

No job queue, no job processing, no provider/DB/queue connection. This
exists purely so the PR that introduces the generation-job queue (Phase 5)
has a process to attach a consumer to.

## Local development

```bash
pnpm --filter @ai-art-platform/worker dev
```
