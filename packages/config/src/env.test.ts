import { describe, expect, it } from "vitest";

import { EnvValidationError, loadEnv } from "./env.js";

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
