import { createPrismaClient, type PrismaClient } from "@ai-art-platform/database";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestApp, httpServerOf } from "./support/create-test-app.js";

interface ErrorResponseBody {
  error: { code: string };
}

describe("Public Tenant API", () => {
  let app: INestApplication;
  let client: PrismaClient;

  beforeAll(async () => {
    app = await createTestApp();
    client = createPrismaClient();
  });

  afterAll(async () => {
    await client.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Delete child rows first — tenant_domains/tenant_settings have an
    // ON DELETE RESTRICT foreign key to tenants (section 8.4), so a
    // leftover row from another spec file sharing this database (Vitest's
    // integration config runs files sequentially, not in isolated
    // databases) would otherwise block this cleanup.
    await client.tenantSetting.deleteMany();
    await client.tenantDomain.deleteMany();
    await client.tenant.deleteMany();
  });

  it("GET /health returns 200 without touching the database", async () => {
    const response = await request(httpServerOf(app)).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("GET /ready returns 200 when migrations are applied and the DB is reachable", async () => {
    const response = await request(httpServerOf(app)).get("/ready");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ready" });
  });

  it("GET /api/v1/public/tenants/:tenantKey returns 200 for an ACTIVE tenant", async () => {
    await client.tenant.create({
      data: {
        tenantKey: "acme",
        name: "Acme",
        status: "ACTIVE",
        timezone: "Asia/Tokyo",
        defaultLocale: "ja-JP",
      },
    });

    const response = await request(httpServerOf(app)).get("/api/v1/public/tenants/acme");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: { tenantKey: "acme", name: "Acme", timezone: "Asia/Tokyo", defaultLocale: "ja-JP" },
    });
  });

  it("returns 400 VALIDATION_ERROR for a malformed tenantKey", async () => {
    const response = await request(httpServerOf(app)).get("/api/v1/public/tenants/BAD_KEY");

    expect(response.status).toBe(400);
    expect((response.body as ErrorResponseBody).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 TENANT_NOT_FOUND for an unknown tenantKey", async () => {
    const response = await request(httpServerOf(app)).get("/api/v1/public/tenants/does-not-exist");

    expect(response.status).toBe(404);
    expect((response.body as ErrorResponseBody).error.code).toBe("TENANT_NOT_FOUND");
  });

  it("returns 403 TENANT_SUSPENDED for a suspended tenant", async () => {
    await client.tenant.create({
      data: {
        tenantKey: "suspended-co",
        name: "Suspended Co",
        status: "SUSPENDED",
        timezone: "Asia/Tokyo",
        defaultLocale: "ja-JP",
      },
    });

    const response = await request(httpServerOf(app)).get("/api/v1/public/tenants/suspended-co");

    expect(response.status).toBe(403);
    expect((response.body as ErrorResponseBody).error.code).toBe("TENANT_SUSPENDED");
  });
});
