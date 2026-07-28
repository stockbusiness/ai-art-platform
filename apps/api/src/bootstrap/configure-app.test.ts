import type { INestApplication } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { configureApp } from "./configure-app.js";

function fakeEnv(overrides: { ADMIN_TRUST_PROXY_HOPS?: number } = {}) {
  return {
    NODE_ENV: "test" as const,
    LOG_LEVEL: "info" as const,
    ADMIN_WEB_ORIGIN: "http://localhost:5173",
    ADMIN_SESSION_TTL_SECONDS: 28800,
    ADMIN_LOGIN_WINDOW_SECONDS: 900,
    ADMIN_LOGIN_ACCOUNT_MAX_FAILURES: 5,
    ADMIN_LOGIN_IP_MAX_FAILURES: 20,
    ADMIN_LOCKOUT_SECONDS: 900,
    AUTH_IP_HASH_SECRET: "test-secret-at-least-16-chars",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    DATABASE_DIRECT_URL: "postgresql://test:test@localhost:5432/test",
    ...overrides,
  };
}

/** Minimal stand-in for the Express `Application` instance configureApp configures. */
function fakeNestApp() {
  const set = vi.fn();
  const use = vi.fn();
  const enableCors = vi.fn();
  const instance = { set };
  const app = {
    use,
    enableCors,
    getHttpAdapter: () => ({ getInstance: () => instance }),
  } as unknown as INestApplication;
  return { app, set, use, enableCors };
}

describe("configureApp — trust proxy wiring (P0-5)", () => {
  it("defaults trust proxy to 0 when ADMIN_TRUST_PROXY_HOPS is unset", () => {
    const { app, set } = fakeNestApp();
    configureApp(app, fakeEnv());
    expect(set).toHaveBeenCalledWith("trust proxy", 0);
  });

  it("passes an explicit ADMIN_TRUST_PROXY_HOPS through unchanged", () => {
    const { app, set } = fakeNestApp();
    configureApp(app, fakeEnv({ ADMIN_TRUST_PROXY_HOPS: 2 }));
    expect(set).toHaveBeenCalledWith("trust proxy", 2);
  });

  it("passes an explicit 0 through as 0, not the nullish-coalescing default path", () => {
    const { app, set } = fakeNestApp();
    configureApp(app, fakeEnv({ ADMIN_TRUST_PROXY_HOPS: 0 }));
    expect(set).toHaveBeenCalledWith("trust proxy", 0);
    expect(set).toHaveBeenCalledTimes(1);
  });

  it("also wires CORS to the exact ADMIN_WEB_ORIGIN, never a wildcard", () => {
    const { app, enableCors } = fakeNestApp();
    configureApp(app, fakeEnv());
    expect(enableCors).toHaveBeenCalledWith({
      origin: "http://localhost:5173",
      credentials: true,
    });
  });
});
