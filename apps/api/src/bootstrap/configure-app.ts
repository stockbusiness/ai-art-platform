import type { ApiEnv } from "@ai-art-platform/config";
import type { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import helmet from "helmet";

/**
 * Shared between `main.ts`'s real bootstrap and every integration test's
 * `createTestApp()` — both must configure the app identically (cookie
 * parsing, security headers, CORS), or the two would silently drift
 * (section 10).
 */
export function configureApp(app: INestApplication, env: ApiEnv): void {
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    // Exact-match single origin — never a wildcard (section 10).
    origin: env.ADMIN_WEB_ORIGIN,
    credentials: true,
  });
}
