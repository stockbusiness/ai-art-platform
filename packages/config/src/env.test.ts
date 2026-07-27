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

describe("apiEnvSchema", () => {
  it("requires DATABASE_URL and DATABASE_DIRECT_URL", () => {
    const env = loadEnv(
      {
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        DATABASE_DIRECT_URL: "postgresql://user:pass@localhost:5432/db",
      },
      apiEnvSchema,
    );
    expect(env.DATABASE_URL).toBe("postgresql://user:pass@localhost:5432/db");
    expect(env.NODE_ENV).toBe("development");
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() =>
      loadEnv({ DATABASE_DIRECT_URL: "postgresql://user:pass@localhost:5432/db" }, apiEnvSchema),
    ).toThrow(EnvValidationError);
  });
});
