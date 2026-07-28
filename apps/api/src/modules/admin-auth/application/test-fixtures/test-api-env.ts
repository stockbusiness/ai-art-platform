import type { ApiEnv } from "@ai-art-platform/config";

/** A valid ApiEnv for unit tests — never read from real process.env. */
export function testApiEnv(overrides: Partial<ApiEnv> = {}): ApiEnv {
  return {
    NODE_ENV: "test",
    LOG_LEVEL: "info",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    DATABASE_DIRECT_URL: "postgresql://test:test@localhost:5432/test",
    ADMIN_WEB_ORIGIN: "http://localhost:5173",
    ADMIN_SESSION_TTL_SECONDS: 8 * 60 * 60,
    ADMIN_LOGIN_WINDOW_SECONDS: 15 * 60,
    ADMIN_LOGIN_ACCOUNT_MAX_FAILURES: 5,
    ADMIN_LOGIN_IP_MAX_FAILURES: 20,
    ADMIN_LOCKOUT_SECONDS: 15 * 60,
    AUTH_IP_HASH_SECRET: "test-secret-at-least-16-chars",
    ...overrides,
  };
}
