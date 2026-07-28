import type { ApiEnv } from "@ai-art-platform/config";
import type { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import type { Application } from "express";
import helmet from "helmet";

import { requestIdMiddleware } from "../infrastructure/http/request-id.js";

/**
 * Shared between `main.ts`'s real bootstrap and every integration test's
 * `createTestApp()` — both must configure the app identically (cookie
 * parsing, security headers, CORS), or the two would silently drift
 * (section 10).
 */
export function configureApp(app: INestApplication, env: ApiEnv): void {
  // First, so every subsequent middleware/Guard/Controller can read the
  // same per-request ID (review-fix P0-6).
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    // Exact-match single origin — never a wildcard (section 10).
    origin: env.ADMIN_WEB_ORIGIN,
    credentials: true,
  });

  // Express's `req.ip` only reflects `X-Forwarded-For` when `trust proxy`
  // is set — otherwise every admin behind a real reverse proxy/load
  // balancer would hash to the proxy's own IP, defeating both the IP-level
  // rate limit and the audit log (review-fix P0-5). Never set this to
  // `true` (unconditional trust — a client could forge its own
  // X-Forwarded-For to bypass rate limiting entirely); a numeric hop
  // count only trusts that many entries counted from the right, i.e. the
  // ones the actual trusted proxies appended.
  const expressInstance = app.getHttpAdapter().getInstance() as Application;
  expressInstance.set("trust proxy", env.ADMIN_TRUST_PROXY_HOPS ?? 0);
}
