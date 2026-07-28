import { describe, expect, it } from "vitest";

import { apiEnvSchema, EnvValidationError, loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("applies defaults when optional variables are absent", () => {
    const env = loadEnv({});
    expect(env).toEqual({ NODE_ENV: "development", LOG_LEVEL: "info" });
  });

  it("accepts explicit valid values", () => {
    const env = loadEnv({ NODE_ENV: "production", LOG_LEVEL: "warn" });
    expect(env).toEqual({ NODE_ENV: "production", LOG_LEVEL: "warn" });
  });

  it("throws a descriptive error for invalid values", () => {
    expect(() => loadEnv({ NODE_ENV: "not-a-real-env" })).toThrow(EnvValidationError);
  });
});

const VALID_ADMIN_AUTH_ENV = {
  ADMIN_WEB_ORIGIN: "http://localhost:5173",
  AUTH_IP_HASH_SECRET: "a".repeat(32),
};

describe("apiEnvSchema", () => {
  it("requires DATABASE_URL and DATABASE_DIRECT_URL", () => {
    const env = loadEnv(
      {
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        DATABASE_DIRECT_URL: "postgresql://user:pass@localhost:5432/db",
        ...VALID_ADMIN_AUTH_ENV,
      },
      apiEnvSchema,
    );
    expect(env.DATABASE_URL).toBe("postgresql://user:pass@localhost:5432/db");
    expect(env.NODE_ENV).toBe("development");
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() =>
      loadEnv(
        {
          DATABASE_DIRECT_URL: "postgresql://user:pass@localhost:5432/db",
          ...VALID_ADMIN_AUTH_ENV,
        },
        apiEnvSchema,
      ),
    ).toThrow(EnvValidationError);
  });

  it("applies default values for admin-auth tuning variables", () => {
    const env = loadEnv(
      {
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        DATABASE_DIRECT_URL: "postgresql://user:pass@localhost:5432/db",
        ...VALID_ADMIN_AUTH_ENV,
      },
      apiEnvSchema,
    );
    expect(env.ADMIN_SESSION_TTL_SECONDS).toBe(8 * 60 * 60);
    expect(env.ADMIN_LOGIN_WINDOW_SECONDS).toBe(15 * 60);
    expect(env.ADMIN_LOGIN_ACCOUNT_MAX_FAILURES).toBe(5);
    expect(env.ADMIN_LOGIN_IP_MAX_FAILURES).toBe(20);
    expect(env.ADMIN_LOCKOUT_SECONDS).toBe(15 * 60);
  });

  it("rejects a missing ADMIN_WEB_ORIGIN", () => {
    expect(() =>
      loadEnv(
        {
          DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
          DATABASE_DIRECT_URL: "postgresql://user:pass@localhost:5432/db",
          AUTH_IP_HASH_SECRET: "a".repeat(32),
        },
        apiEnvSchema,
      ),
    ).toThrow(EnvValidationError);
  });

  it("rejects an AUTH_IP_HASH_SECRET shorter than 16 characters", () => {
    expect(() =>
      loadEnv(
        {
          DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
          DATABASE_DIRECT_URL: "postgresql://user:pass@localhost:5432/db",
          ADMIN_WEB_ORIGIN: "http://localhost:5173",
          AUTH_IP_HASH_SECRET: "short",
        },
        apiEnvSchema,
      ),
    ).toThrow(EnvValidationError);
  });
});
