import { z } from "zod";

export const nodeEnvSchema = z.enum(["development", "test", "production"]);
export type NodeEnv = z.infer<typeof nodeEnvSchema>;

export const logLevelSchema = z.enum(["fatal", "error", "warn", "info", "debug", "trace"]);
export type LogLevel = z.infer<typeof logLevelSchema>;

/**
 * PR-01 intentionally validates only the variables every app needs to boot.
 * Database, LINE, Stripe, and provider credentials are out of scope until
 * the PRs that introduce those integrations.
 */
export const baseEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  LOG_LEVEL: logLevelSchema.default("info"),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

/**
 * Coerces a numeric env var with a fallback default, rejecting non-numeric
 * or non-positive values instead of silently falling back to the default
 * for a typo'd value.
 */
function positiveIntEnv(defaultValue: number) {
  return z.coerce.number().int().positive().default(defaultValue);
}

/**
 * Server-only environment schema (apps/api). Adds the DB connection
 * strings introduced in PR-02, plus the PR-03A Admin Authentication /
 * Session / RBAC configuration (section 10). Never import this from a
 * browser app (admin-web, liff-web) — DB URLs and AUTH_IP_HASH_SECRET
 * must never reach a client bundle.
 */
export const apiEnvSchema = baseEnvSchema.extend({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_DIRECT_URL: z.string().min(1, "DATABASE_DIRECT_URL is required"),
  // Exact-match CORS origin for apps/admin-web — never a wildcard
  // (section 10: "ADMIN_WEB_ORIGINをExact Match, wildcard禁止").
  ADMIN_WEB_ORIGIN: z.string().min(1, "ADMIN_WEB_ORIGIN is required"),
  // 8 hours, matching the fixed Session Cookie Max-Age (section 3.4).
  ADMIN_SESSION_TTL_SECONDS: positiveIntEnv(8 * 60 * 60),
  // Rolling window for the IP-level login rate limit (section 3.5).
  ADMIN_LOGIN_WINDOW_SECONDS: positiveIntEnv(15 * 60),
  ADMIN_LOGIN_ACCOUNT_MAX_FAILURES: positiveIntEnv(5),
  ADMIN_LOGIN_IP_MAX_FAILURES: positiveIntEnv(20),
  ADMIN_LOCKOUT_SECONDS: positiveIntEnv(15 * 60),
  // HMAC-SHA256 key for hashing IP addresses, User-Agents, and emails
  // before they are ever written to admin_sessions/admin_login_events
  // (section 3.5/4.3/4.4) — never logged, never sent to a browser app.
  AUTH_IP_HASH_SECRET: z.string().min(16, "AUTH_IP_HASH_SECRET must be at least 16 characters"),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export class EnvValidationError extends Error {
  constructor(public readonly issues: z.ZodIssue[]) {
    const details = issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    super(`Invalid environment configuration:\n${details}`);
    this.name = "EnvValidationError";
  }
}

/**
 * Parses and validates environment variables against a schema, throwing a
 * human-readable EnvValidationError on failure instead of letting an app
 * boot with silently-wrong configuration.
 */
export function loadEnv<TSchema extends z.ZodTypeAny = typeof baseEnvSchema>(
  source: Record<string, string | undefined> = process.env,
  schema: TSchema = baseEnvSchema as unknown as TSchema,
): z.infer<TSchema> {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(result.error.issues);
  }
  return result.data as z.infer<TSchema>;
}
