import { randomUUID } from "node:crypto";

import { createPrismaClient, type PrismaClient } from "@ai-art-platform/database";
import { AdminEmail, AdminName, AdminUser, Tenant, TenantKey } from "@ai-art-platform/domain";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaService } from "../../src/infrastructure/database/prisma.service.js";
import { Argon2PasswordHasher } from "../../src/modules/admin-auth/infrastructure/argon2-password-hasher.js";
import { PrismaAdminUserRepository } from "../../src/modules/admin-auth/infrastructure/prisma-admin-user.repository.js";
import { PrismaTenantRepository } from "../../src/modules/tenant/infrastructure/prisma-tenant.repository.js";

import { createTestApp, httpServerOf } from "./support/create-test-app.js";

interface ErrorResponseBody {
  error: { code: string };
}

interface LoginResponseBody {
  data: { admin: { id: string; tenantId: string | null; tenantKey: string | null; role: string } };
}

const PASSWORD = "correct-horse-battery";
const SESSION_COOKIE = "ai_art_admin_session";
const CSRF_COOKIE = "ai_art_admin_csrf";

function anEmail(raw: string): AdminEmail {
  const result = AdminEmail.create(raw);
  if (!result.ok) throw result.error;
  return result.value;
}

function aName(raw: string): AdminName {
  const result = AdminName.create(raw);
  if (!result.ok) throw result.error;
  return result.value;
}

describe("Admin Auth API (section 13.3)", () => {
  let app: INestApplication;
  let client: PrismaClient;
  let tenantRepository: PrismaTenantRepository;
  let adminUserRepository: PrismaAdminUserRepository;
  const passwordHasher = new Argon2PasswordHasher();

  beforeAll(async () => {
    app = await createTestApp();
    client = createPrismaClient();
    const prismaService = new PrismaService();
    tenantRepository = new PrismaTenantRepository(prismaService);
    adminUserRepository = new PrismaAdminUserRepository(prismaService);
  });

  afterAll(async () => {
    await client.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await client.adminLoginEvent.deleteMany();
    await client.adminSession.deleteMany();
    await client.adminUser.deleteMany();
    await client.tenantSetting.deleteMany();
    await client.tenantDomain.deleteMany();
    await client.tenant.deleteMany();
  });

  async function seedTenant(tenantKeyRaw: string): Promise<Tenant> {
    const tenantKeyResult = TenantKey.create(tenantKeyRaw);
    if (!tenantKeyResult.ok) throw tenantKeyResult.error;
    const tenant = Tenant.create({
      id: randomUUID(),
      tenantKey: tenantKeyResult.value,
      name: "T",
      now: new Date(),
    });
    await tenantRepository.create(tenant);
    return tenant;
  }

  async function seedAdmin(input: {
    tenantId: string | null;
    email: string;
    role: "SUPER_ADMIN" | "TENANT_OWNER";
    password?: string;
  }): Promise<AdminUser> {
    const admin = AdminUser.create({
      id: randomUUID(),
      tenantId: input.tenantId,
      email: anEmail(input.email),
      passwordHash: await passwordHasher.hash(input.password ?? PASSWORD),
      name: aName("Admin"),
      role: input.role,
      now: new Date(),
    });
    await adminUserRepository.create(admin);
    return admin;
  }

  function cookieValue(setCookieHeaders: string[] | undefined, name: string): string | undefined {
    const header = setCookieHeaders?.find((c) => c.startsWith(`${name}=`));
    return header?.split(";")[0]?.split("=")[1];
  }

  describe("POST /api/v1/admin/auth/login — success", () => {
    it("logs in a Tenant-scoped admin and sets both Cookies with correct attributes", async () => {
      const tenant = await seedTenant("acme");
      await seedAdmin({
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });

      const response = await request(httpServerOf(app))
        .post("/api/v1/admin/auth/login")
        .send({ tenantKey: "acme", email: "owner@acme.example.com", password: PASSWORD });

      expect(response.status).toBe(200);
      const body = response.body as LoginResponseBody;
      expect(body.data.admin.tenantId).toBe(tenant.id);
      expect(body.data.admin.role).toBe("TENANT_OWNER");

      const setCookie = response.headers["set-cookie"] as unknown as string[] | undefined;
      const sessionCookieHeader = setCookie?.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
      const csrfCookieHeader = setCookie?.find((c) => c.startsWith(`${CSRF_COOKIE}=`));
      expect(sessionCookieHeader).toContain("HttpOnly");
      expect(sessionCookieHeader).toContain("SameSite=Lax");
      expect(sessionCookieHeader).toMatch(/Max-Age=\d+/);
      expect(csrfCookieHeader).not.toContain("HttpOnly");
      expect(csrfCookieHeader).toContain("SameSite=Lax");
    });

    it("logs in a SUPER_ADMIN without a tenantKey", async () => {
      await seedAdmin({ tenantId: null, email: "root@example.com", role: "SUPER_ADMIN" });

      const response = await request(httpServerOf(app))
        .post("/api/v1/admin/auth/login")
        .send({ email: "root@example.com", password: PASSWORD });

      expect(response.status).toBe(200);
      const body = response.body as LoginResponseBody;
      expect(body.data.admin.tenantId).toBeNull();
      expect(body.data.admin.role).toBe("SUPER_ADMIN");
    });

    it("records a successful login event and resets a prior failure count", async () => {
      const tenant = await seedTenant("acme");
      const admin = await seedAdmin({
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });

      await request(httpServerOf(app))
        .post("/api/v1/admin/auth/login")
        .send({ tenantKey: "acme", email: "owner@acme.example.com", password: "wrong" });

      const afterFailure = await client.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
      expect(afterFailure.failedLoginCount).toBe(1);

      await request(httpServerOf(app))
        .post("/api/v1/admin/auth/login")
        .send({ tenantKey: "acme", email: "owner@acme.example.com", password: PASSWORD })
        .expect(200);

      const afterSuccess = await client.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
      expect(afterSuccess.failedLoginCount).toBe(0);
      expect(afterSuccess.lastLoginAt).not.toBeNull();

      const events = await client.adminLoginEvent.findMany({
        where: { adminUserId: admin.id },
        orderBy: { createdAt: "asc" },
      });
      expect(events).toHaveLength(2);
      expect(events[0]?.success).toBe(false);
      expect(events[1]?.success).toBe(true);
    });
  });

  describe("GET /api/v1/admin/auth/me", () => {
    it("returns the authenticated admin's summary", async () => {
      const tenant = await seedTenant("acme");
      await seedAdmin({
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });
      const agent = request.agent(httpServerOf(app));
      await agent
        .post("/api/v1/admin/auth/login")
        .send({ tenantKey: "acme", email: "owner@acme.example.com", password: PASSWORD });

      const response = await agent.get("/api/v1/admin/auth/me");

      expect(response.status).toBe(200);
      const body = response.body as { data: { admin: { email: string; tenantKey: string } } };
      expect(body.data.admin.email).toBe("owner@acme.example.com");
      expect(body.data.admin.tenantKey).toBe("acme");
    });

    it("returns 401 UNAUTHENTICATED without a session cookie", async () => {
      const response = await request(httpServerOf(app)).get("/api/v1/admin/auth/me");
      expect(response.status).toBe(401);
      expect((response.body as ErrorResponseBody).error.code).toBe("UNAUTHENTICATED");
    });

    it("returns 401 UNAUTHENTICATED for a tampered/unknown session cookie", async () => {
      const response = await request(httpServerOf(app))
        .get("/api/v1/admin/auth/me")
        .set("Cookie", [`${SESSION_COOKIE}=not-a-real-token`]);
      expect(response.status).toBe(401);
    });

    it("ignores a client-supplied tenantId — the response always reflects the Session's own Tenant", async () => {
      const tenantA = await seedTenant("acme");
      const tenantB = await seedTenant("globex");
      await seedAdmin({
        tenantId: tenantA.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });
      const agent = request.agent(httpServerOf(app));
      await agent
        .post("/api/v1/admin/auth/login")
        .send({ tenantKey: "acme", email: "owner@acme.example.com", password: PASSWORD });

      const response = await agent
        .get("/api/v1/admin/auth/me")
        .set("X-Tenant-Id", tenantB.id)
        .query({ tenantId: tenantB.id });

      expect(response.status).toBe(200);
      const body = response.body as { data: { admin: { tenantId: string; tenantKey: string } } };
      expect(body.data.admin.tenantId).toBe(tenantA.id);
      expect(body.data.admin.tenantKey).toBe("acme");
    });
  });

  describe("POST /api/v1/admin/auth/login — failure paths (all generically AUTHENTICATION_FAILED)", () => {
    async function expectGenericFailure(body: Record<string, unknown>): Promise<void> {
      const response = await request(httpServerOf(app)).post("/api/v1/admin/auth/login").send(body);
      expect(response.status).toBe(401);
      expect((response.body as ErrorResponseBody).error.code).toBe("AUTHENTICATION_FAILED");
    }

    it("unknown tenantKey", async () => {
      await expectGenericFailure({
        tenantKey: "does-not-exist",
        email: "x@example.com",
        password: PASSWORD,
      });
    });

    it("unknown email", async () => {
      const tenant = await seedTenant("acme");
      await expectGenericFailure({
        tenantKey: tenant.tenantKey.toString(),
        email: "nobody@acme.example.com",
        password: PASSWORD,
      });
    });

    it("wrong password", async () => {
      const tenant = await seedTenant("acme");
      await seedAdmin({
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });
      await expectGenericFailure({
        tenantKey: "acme",
        email: "owner@acme.example.com",
        password: "wrong-password",
      });
    });

    it("DISABLED admin", async () => {
      const tenant = await seedTenant("acme");
      const admin = await seedAdmin({
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });
      await client.adminUser.update({ where: { id: admin.id }, data: { status: "DISABLED" } });
      await expectGenericFailure({
        tenantKey: "acme",
        email: "owner@acme.example.com",
        password: PASSWORD,
      });
    });

    it("SUSPENDED tenant", async () => {
      const tenant = await seedTenant("acme");
      await seedAdmin({
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });
      await client.tenant.update({ where: { id: tenant.id }, data: { status: "SUSPENDED" } });
      await expectGenericFailure({
        tenantKey: "acme",
        email: "owner@acme.example.com",
        password: PASSWORD,
      });
    });

    it("tenantKey omitted for a Tenant-scoped admin (never falls back to SUPER_ADMIN search)", async () => {
      const tenant = await seedTenant("acme");
      await seedAdmin({
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });
      await expectGenericFailure({ email: "owner@acme.example.com", password: PASSWORD });
    });

    it("tenantKey present for a SUPER_ADMIN email (never falls back to Tenant search)", async () => {
      const tenant = await seedTenant("acme");
      await seedAdmin({ tenantId: null, email: "root@example.com", role: "SUPER_ADMIN" });
      await expectGenericFailure({
        tenantKey: tenant.tenantKey.toString(),
        email: "root@example.com",
        password: PASSWORD,
      });
    });

    it("malformed request body (missing password)", async () => {
      await expectGenericFailure({ email: "owner@acme.example.com" });
    });
  });

  describe("Lockout and IP rate limiting", () => {
    it("locks the account after ADMIN_LOGIN_ACCOUNT_MAX_FAILURES and rejects even the correct password with 429", async () => {
      const tenant = await seedTenant("acme");
      await seedAdmin({
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });

      const attempt = () =>
        request(httpServerOf(app))
          .post("/api/v1/admin/auth/login")
          .send({ tenantKey: "acme", email: "owner@acme.example.com", password: "wrong" });

      // Default ADMIN_LOGIN_ACCOUNT_MAX_FAILURES=5.
      for (let i = 0; i < 5; i += 1) {
        const response = await attempt();
        expect(response.status).toBe(401);
      }

      const lockedResponse = await request(httpServerOf(app))
        .post("/api/v1/admin/auth/login")
        .send({ tenantKey: "acme", email: "owner@acme.example.com", password: PASSWORD });
      expect(lockedResponse.status).toBe(429);
      expect((lockedResponse.body as ErrorResponseBody).error.code).toBe("TOO_MANY_ATTEMPTS");
    });

    it("rejects further login attempts from the same IP once ADMIN_LOGIN_IP_MAX_FAILURES is reached", async () => {
      const tenant = await seedTenant("acme");
      // Default ADMIN_LOGIN_IP_MAX_FAILURES=20 — use 20 distinct unknown
      // emails so account-level lockout (threshold 5) never triggers first.
      for (let i = 0; i < 20; i += 1) {
        const response = await request(httpServerOf(app))
          .post("/api/v1/admin/auth/login")
          .send({
            tenantKey: tenant.tenantKey.toString(),
            email: `nobody-${i}@acme.example.com`,
            password: "wrong",
          });
        expect(response.status).toBe(401);
      }

      const rateLimited = await request(httpServerOf(app)).post("/api/v1/admin/auth/login").send({
        tenantKey: tenant.tenantKey.toString(),
        email: "yet-another@acme.example.com",
        password: "wrong",
      });
      expect(rateLimited.status).toBe(429);
      expect((rateLimited.body as ErrorResponseBody).error.code).toBe("TOO_MANY_ATTEMPTS");
    }, 30_000);
  });

  describe("Logout and CSRF", () => {
    it("revokes the session, clears both cookies, and returns 204", async () => {
      const tenant = await seedTenant("acme");
      await seedAdmin({
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });
      const agent = request.agent(httpServerOf(app));
      const loginResponse = await agent
        .post("/api/v1/admin/auth/login")
        .send({ tenantKey: "acme", email: "owner@acme.example.com", password: PASSWORD });
      const csrfToken = cookieValue(
        loginResponse.headers["set-cookie"] as unknown as string[] | undefined,
        CSRF_COOKIE,
      );
      expect(csrfToken).toBeTruthy();

      const logoutResponse = await agent
        .post("/api/v1/admin/auth/logout")
        .set("X-CSRF-Token", csrfToken ?? "");
      expect(logoutResponse.status).toBe(204);

      const meResponse = await agent.get("/api/v1/admin/auth/me");
      expect(meResponse.status).toBe(401);
    });

    it("a second logout with the same (now-revoked) cookie fails safely with 401, not a 500", async () => {
      const tenant = await seedTenant("acme");
      await seedAdmin({
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });
      const agent = request.agent(httpServerOf(app));
      const loginResponse = await agent
        .post("/api/v1/admin/auth/login")
        .send({ tenantKey: "acme", email: "owner@acme.example.com", password: PASSWORD });
      const csrfToken = cookieValue(
        loginResponse.headers["set-cookie"] as unknown as string[] | undefined,
        CSRF_COOKIE,
      );

      await agent.post("/api/v1/admin/auth/logout").set("X-CSRF-Token", csrfToken ?? "");
      const secondLogout = await agent
        .post("/api/v1/admin/auth/logout")
        .set("X-CSRF-Token", csrfToken ?? "");

      expect(secondLogout.status).toBe(401);
    });

    it("rejects logout with a missing X-CSRF-Token header", async () => {
      const tenant = await seedTenant("acme");
      await seedAdmin({
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });
      const agent = request.agent(httpServerOf(app));
      await agent
        .post("/api/v1/admin/auth/login")
        .send({ tenantKey: "acme", email: "owner@acme.example.com", password: PASSWORD });

      const response = await agent.post("/api/v1/admin/auth/logout");
      expect(response.status).toBe(403);
      expect((response.body as ErrorResponseBody).error.code).toBe("FORBIDDEN");
    });

    it("rejects logout when the CSRF Cookie is missing", async () => {
      const tenant = await seedTenant("acme");
      await seedAdmin({
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });
      const loginResponse = await request(httpServerOf(app))
        .post("/api/v1/admin/auth/login")
        .send({ tenantKey: "acme", email: "owner@acme.example.com", password: PASSWORD });
      const sessionToken = cookieValue(
        loginResponse.headers["set-cookie"] as unknown as string[] | undefined,
        SESSION_COOKIE,
      );

      // Only the Session Cookie is replayed — no CSRF Cookie at all.
      const response = await request(httpServerOf(app))
        .post("/api/v1/admin/auth/logout")
        .set("Cookie", [`${SESSION_COOKIE}=${sessionToken}`])
        .set("X-CSRF-Token", "some-arbitrary-value");
      expect(response.status).toBe(403);
    });

    it("rejects logout when the Header value does not match the Cookie value", async () => {
      const tenant = await seedTenant("acme");
      await seedAdmin({
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });
      const agent = request.agent(httpServerOf(app));
      await agent
        .post("/api/v1/admin/auth/login")
        .send({ tenantKey: "acme", email: "owner@acme.example.com", password: PASSWORD });

      const response = await agent
        .post("/api/v1/admin/auth/logout")
        .set("X-CSRF-Token", "wrong-value");
      expect(response.status).toBe(403);
    });
  });

  describe("Tenant boundary (section 13.3)", () => {
    it("the same email in two different Tenants logs into the correct Tenant each time", async () => {
      const tenantA = await seedTenant("acme");
      const tenantB = await seedTenant("globex");
      await seedAdmin({ tenantId: tenantA.id, email: "shared@example.com", role: "TENANT_OWNER" });
      await seedAdmin({ tenantId: tenantB.id, email: "shared@example.com", role: "TENANT_OWNER" });

      const loginA = await request(httpServerOf(app))
        .post("/api/v1/admin/auth/login")
        .send({ tenantKey: "acme", email: "shared@example.com", password: PASSWORD });
      const loginB = await request(httpServerOf(app))
        .post("/api/v1/admin/auth/login")
        .send({ tenantKey: "globex", email: "shared@example.com", password: PASSWORD });

      expect((loginA.body as LoginResponseBody).data.admin.tenantId).toBe(tenantA.id);
      expect((loginB.body as LoginResponseBody).data.admin.tenantId).toBe(tenantB.id);
    });

    it("a Session from Tenant A can never resolve Tenant B's context", async () => {
      const tenantA = await seedTenant("acme");
      const tenantB = await seedTenant("globex");
      await seedAdmin({ tenantId: tenantA.id, email: "shared@example.com", role: "TENANT_OWNER" });
      await seedAdmin({ tenantId: tenantB.id, email: "shared@example.com", role: "TENANT_OWNER" });

      const agent = request.agent(httpServerOf(app));
      await agent
        .post("/api/v1/admin/auth/login")
        .send({ tenantKey: "acme", email: "shared@example.com", password: PASSWORD });

      const meResponse = await agent.get("/api/v1/admin/auth/me");
      const body = meResponse.body as { data: { admin: { tenantId: string } } };
      expect(body.data.admin.tenantId).toBe(tenantA.id);
      expect(body.data.admin.tenantId).not.toBe(tenantB.id);
    });
  });
});
