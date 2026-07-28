import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestApp, httpServerOf } from "./support/create-test-app.js";

/**
 * Verifies the app boots and GET /health responds even when the database
 * is completely unreachable — the failure mode that motivated removing
 * PrismaService's eager $connect() in onModuleInit (see
 * IMPLEMENTATION_HISTORY_PR02.md). Runs the full Nest app (not a
 * hand-built controller) so the actual DI/lifecycle wiring is exercised.
 */
describe("App startup with the database down", () => {
  let app: INestApplication;
  let originalDatabaseUrl: string | undefined;
  let originalDatabaseDirectUrl: string | undefined;

  beforeAll(async () => {
    originalDatabaseUrl = process.env["DATABASE_URL"];
    originalDatabaseDirectUrl = process.env["DATABASE_DIRECT_URL"];
    // Port 1 is never a real Postgres — connection fails fast rather than
    // hanging on a timeout.
    const unreachableUrl = "postgresql://aiart:aiart_local@localhost:1/unreachable";
    process.env["DATABASE_URL"] = unreachableUrl;
    process.env["DATABASE_DIRECT_URL"] = unreachableUrl;

    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    process.env["DATABASE_URL"] = originalDatabaseUrl;
    process.env["DATABASE_DIRECT_URL"] = originalDatabaseDirectUrl;
  });

  it("boots successfully without connecting to the database", () => {
    expect(app).toBeDefined();
  });

  it("GET /health still returns 200", async () => {
    const response = await request(httpServerOf(app)).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("GET /ready returns 503 because the database is unreachable", async () => {
    const response = await request(httpServerOf(app)).get("/ready");
    expect(response.status).toBe(503);
  });

  it("GET /api/v1/public/tenants/:tenantKey returns 503 DATABASE_UNAVAILABLE", async () => {
    const response = await request(httpServerOf(app)).get("/api/v1/public/tenants/default");
    expect(response.status).toBe(503);
    expect((response.body as { error: { code: string } }).error.code).toBe("DATABASE_UNAVAILABLE");
  });

  // review-fix P0-7: an unreachable DB must never be reported as
  // "you are not authenticated" (401) — that would be misleading (the
  // credentials/session might be perfectly valid) and would make a real
  // outage indistinguishable from a routine login failure in monitoring.
  it("POST /api/v1/admin/auth/login returns 503 AUTH_SERVICE_UNAVAILABLE, not 401", async () => {
    const response = await request(httpServerOf(app)).post("/api/v1/admin/auth/login").send({
      email: "owner@example.com",
      password: "irrelevant-password-12345",
    });
    expect(response.status).toBe(503);
    const body = response.body as { error: { code: string; requestId: string } };
    expect(body.error.code).toBe("AUTH_SERVICE_UNAVAILABLE");
    expect(body.error.requestId).toBeTruthy();
  });

  it("GET /api/v1/admin/auth/me returns 503 AUTH_SERVICE_UNAVAILABLE, not 401", async () => {
    const response = await request(httpServerOf(app))
      .get("/api/v1/admin/auth/me")
      .set("Cookie", "ai_art_admin_session=some-opaque-token-value");
    expect(response.status).toBe(503);
    expect((response.body as { error: { code: string } }).error.code).toBe(
      "AUTH_SERVICE_UNAVAILABLE",
    );
  });
});
