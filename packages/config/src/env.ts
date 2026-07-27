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
 * Server-only environment schema (apps/api). Adds the DB connection
 * strings introduced in PR-02. Never import this from a browser app
 * (admin-web, liff-web) — DB URLs must never reach a client bundle.
 */
export const apiEnvSchema = baseEnvSchema.extend({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_DIRECT_URL: z.string().min(1, "DATABASE_DIRECT_URL is required"),
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
