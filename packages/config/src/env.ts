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
export const apiEnvSchema = baseEnvSchema
  .extend({
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
    // Number of trusted reverse-proxy hops in front of the API, passed to
    // Express's `trust proxy` setting — controls how many `X-Forwarded-For`
    // entries (counted from the right) are trusted when computing the
    // client IP used for rate limiting / audit hashing (review-fix P0-5).
    // Left unset in development/test (defaults to 0 — trust nothing, use
    // the raw socket address); a production deployment must set this
    // explicitly to the actual number of proxies it sits behind, never
    // `true` (which would trust an attacker-supplied X-Forwarded-For
    // unconditionally).
    ADMIN_TRUST_PROXY_HOPS: z.coerce
      .number()
      .int("ADMIN_TRUST_PROXY_HOPS must be a whole number")
      .min(0, "ADMIN_TRUST_PROXY_HOPS must not be negative")
      .optional(),
  })
  .superRefine((value, ctx) => {
    // Production must not silently fall back to "trust nothing" (which
    // would be safe but likely wrong behind a real load balancer) or —
    // worse — get configured with an unconditional `true`-like "trust
    // everything" value. Forcing an explicit hop count in production means
    // a misconfigured deployment fails fast at boot instead of silently
    // hashing the load balancer's IP for every admin (P0-5).
    if (value.NODE_ENV === "production" && value.ADMIN_TRUST_PROXY_HOPS === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ADMIN_TRUST_PROXY_HOPS"],
        message: "ADMIN_TRUST_PROXY_HOPS must be explicitly set in production",
      });
    }
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
