import { randomUUID } from "node:crypto";

import {
  AdminAuthenticationFailedError,
  AdminEmail,
  AdminName,
  AdminTooManyAttemptsError,
  AdminUser,
  Tenant,
  TenantKey,
} from "@ai-art-platform/domain";
import { describe, expect, it } from "vitest";

import { InMemoryTenantRepository } from "../../tenant/application/test-fixtures/in-memory-tenant.repository.js";

import { LoginAdminUseCase } from "./login-admin.use-case.js";
import { FakePasswordHasher } from "./test-fixtures/fake-password-hasher.js";
import { FakeSessionTokenService } from "./test-fixtures/fake-session-token.service.js";
import { FixedAuthClock } from "./test-fixtures/fixed-auth-clock.js";
import { InMemoryAdminLoginEventRepository } from "./test-fixtures/in-memory-admin-login-event.repository.js";
import { InMemoryAdminSessionRepository } from "./test-fixtures/in-memory-admin-session.repository.js";
import { InMemoryAdminUserRepository } from "./test-fixtures/in-memory-admin-user.repository.js";
import { testApiEnv } from "./test-fixtures/test-api-env.js";

function anEmail(raw: string): AdminEmail {
  const result = AdminEmail.create(raw);
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}

function aName(raw: string): AdminName {
  const result = AdminName.create(raw);
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}

const PASSWORD = "correct-horse-battery";
const NOW = new Date("2026-01-01T00:00:00Z");

function buildHarness(
  overrides: { maxFailures?: number; lockoutSeconds?: number; ipMaxFailures?: number } = {},
) {
  const adminUsers = new InMemoryAdminUserRepository();
  const sessions = new InMemoryAdminSessionRepository();
  const loginEvents = new InMemoryAdminLoginEventRepository();
  const tenants = new InMemoryTenantRepository();
  const passwordHasher = new FakePasswordHasher();
  const sessionTokens = new FakeSessionTokenService();
  const clock = new FixedAuthClock(NOW);
  const env = testApiEnv({
    ADMIN_LOGIN_ACCOUNT_MAX_FAILURES: overrides.maxFailures ?? 5,
    ADMIN_LOCKOUT_SECONDS: overrides.lockoutSeconds ?? 900,
    ADMIN_LOGIN_IP_MAX_FAILURES: overrides.ipMaxFailures ?? 20,
  });

  const useCase = new LoginAdminUseCase(
    adminUsers,
    sessions,
    loginEvents,
    tenants,
    passwordHasher,
    sessionTokens,
    clock,
    env,
  );

  return { useCase, adminUsers, sessions, loginEvents, tenants, passwordHasher, clock, env };
}

async function seedTenant(
  tenants: InMemoryTenantRepository,
  tenantKeyRaw: string,
): Promise<Tenant> {
  const tenantKeyResult = TenantKey.create(tenantKeyRaw);
  if (!tenantKeyResult.ok) {
    throw tenantKeyResult.error;
  }
  const tenant = Tenant.create({
    id: randomUUID(),
    tenantKey: tenantKeyResult.value,
    name: "Test Tenant",
    now: NOW,
  });
  await tenants.create(tenant);
  return tenant;
}

async function seedAdmin(
  adminUsers: InMemoryAdminUserRepository,
  passwordHasher: FakePasswordHasher,
  input: { tenantId: string | null; email: string; role: "SUPER_ADMIN" | "TENANT_OWNER" },
): Promise<AdminUser> {
  const admin = AdminUser.create({
    id: randomUUID(),
    tenantId: input.tenantId,
    email: anEmail(input.email),
    passwordHash: await passwordHasher.hash(PASSWORD),
    name: aName("Admin"),
    role: input.role,
    now: NOW,
  });
  await adminUsers.create(admin);
  return admin;
}

describe("LoginAdminUseCase", () => {
  describe("Tenant-scoped admin", () => {
    it("succeeds with correct tenantKey/email/password", async () => {
      const { useCase, adminUsers, tenants, passwordHasher } = buildHarness();
      const tenant = await seedTenant(tenants, "acme");
      await seedAdmin(adminUsers, passwordHasher, {
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });

      const result = await useCase.execute({
        tenantKeyRaw: "acme",
        emailRaw: "owner@acme.example.com",
        password: PASSWORD,
        ip: "203.0.113.1",
        userAgent: "vitest",
        requestId: "req-1",
      });

      expect(result.admin.role).toBe("TENANT_OWNER");
      expect(result.tenantKey).toBe("acme");
      expect(result.sessionToken).toBeTruthy();
      expect(result.csrfToken).toBeTruthy();
    });

    it("rejects an unknown tenantKey with the generic error", async () => {
      const { useCase } = buildHarness();

      await expect(
        useCase.execute({
          tenantKeyRaw: "does-not-exist",
          emailRaw: "owner@acme.example.com",
          password: PASSWORD,
          ip: "203.0.113.1",
          userAgent: "vitest",
          requestId: "req-1",
        }),
      ).rejects.toBeInstanceOf(AdminAuthenticationFailedError);
    });

    it("rejects login against a SUSPENDED tenant", async () => {
      const { useCase, adminUsers, tenants, passwordHasher } = buildHarness();
      const tenant = await seedTenant(tenants, "acme");
      tenant.changeStatus("SUSPENDED", NOW);
      await tenants.update(tenant);
      await seedAdmin(adminUsers, passwordHasher, {
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });

      await expect(
        useCase.execute({
          tenantKeyRaw: "acme",
          emailRaw: "owner@acme.example.com",
          password: PASSWORD,
          ip: "203.0.113.1",
          userAgent: "vitest",
          requestId: "req-1",
        }),
      ).rejects.toBeInstanceOf(AdminAuthenticationFailedError);
    });

    it("rejects an unknown email with the same generic error as a wrong password", async () => {
      const { useCase, tenants } = buildHarness();
      await seedTenant(tenants, "acme");

      await expect(
        useCase.execute({
          tenantKeyRaw: "acme",
          emailRaw: "nobody@acme.example.com",
          password: PASSWORD,
          ip: "203.0.113.1",
          userAgent: "vitest",
          requestId: "req-1",
        }),
      ).rejects.toBeInstanceOf(AdminAuthenticationFailedError);
    });

    it("rejects a wrong password", async () => {
      const { useCase, adminUsers, tenants, passwordHasher } = buildHarness();
      const tenant = await seedTenant(tenants, "acme");
      await seedAdmin(adminUsers, passwordHasher, {
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });

      await expect(
        useCase.execute({
          tenantKeyRaw: "acme",
          emailRaw: "owner@acme.example.com",
          password: "totally-wrong-password",
          ip: "203.0.113.1",
          userAgent: "vitest",
          requestId: "req-1",
        }),
      ).rejects.toBeInstanceOf(AdminAuthenticationFailedError);
    });

    it("rejects a DISABLED admin", async () => {
      const { useCase, adminUsers, tenants, passwordHasher } = buildHarness();
      const tenant = await seedTenant(tenants, "acme");
      const admin = await seedAdmin(adminUsers, passwordHasher, {
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });
      // No public "disable" method exists on AdminUser (out of scope for
      // PR-03A) — reconstitute directly with DISABLED status instead.
      const disabled = AdminUser.reconstitute({
        id: admin.id,
        tenantId: admin.tenantId,
        email: admin.email,
        passwordHash: admin.passwordHash,
        name: admin.name,
        role: admin.role,
        status: "DISABLED",
        failedLoginCount: admin.failedLoginCount,
        lockedUntil: admin.lockedUntil,
        lastLoginAt: admin.lastLoginAt,
        passwordChangedAt: NOW,
        createdAt: NOW,
        updatedAt: NOW,
      });
      await adminUsers.update(disabled);

      await expect(
        useCase.execute({
          tenantKeyRaw: "acme",
          emailRaw: "owner@acme.example.com",
          password: PASSWORD,
          ip: "203.0.113.1",
          userAgent: "vitest",
          requestId: "req-1",
        }),
      ).rejects.toBeInstanceOf(AdminAuthenticationFailedError);
    });

    it("never finds a Tenant admin when tenantKey is omitted", async () => {
      const { useCase, adminUsers, tenants, passwordHasher } = buildHarness();
      const tenant = await seedTenant(tenants, "acme");
      await seedAdmin(adminUsers, passwordHasher, {
        tenantId: tenant.id,
        email: "shared@example.com",
        role: "TENANT_OWNER",
      });

      await expect(
        useCase.execute({
          tenantKeyRaw: null,
          emailRaw: "shared@example.com",
          password: PASSWORD,
          ip: "203.0.113.1",
          userAgent: "vitest",
          requestId: "req-1",
        }),
      ).rejects.toBeInstanceOf(AdminAuthenticationFailedError);
    });
  });

  describe("SUPER_ADMIN", () => {
    it("succeeds without a tenantKey", async () => {
      const { useCase, adminUsers, passwordHasher } = buildHarness();
      await seedAdmin(adminUsers, passwordHasher, {
        tenantId: null,
        email: "root@example.com",
        role: "SUPER_ADMIN",
      });

      const result = await useCase.execute({
        tenantKeyRaw: null,
        emailRaw: "root@example.com",
        password: PASSWORD,
        ip: "203.0.113.1",
        userAgent: "vitest",
        requestId: "req-1",
      });

      expect(result.admin.role).toBe("SUPER_ADMIN");
      expect(result.tenantKey).toBeNull();
    });

    it("never finds a SUPER_ADMIN when tenantKey is present, even for a matching Tenant", async () => {
      const { useCase, adminUsers, tenants, passwordHasher } = buildHarness();
      await seedTenant(tenants, "acme");
      await seedAdmin(adminUsers, passwordHasher, {
        tenantId: null,
        email: "shared@example.com",
        role: "SUPER_ADMIN",
      });

      await expect(
        useCase.execute({
          tenantKeyRaw: "acme",
          emailRaw: "shared@example.com",
          password: PASSWORD,
          ip: "203.0.113.1",
          userAgent: "vitest",
          requestId: "req-1",
        }),
      ).rejects.toBeInstanceOf(AdminAuthenticationFailedError);
    });
  });

  describe("Account lockout", () => {
    it("locks the account after the configured number of failures and returns 429-mapped error", async () => {
      const { useCase, adminUsers, tenants, passwordHasher } = buildHarness({ maxFailures: 3 });
      const tenant = await seedTenant(tenants, "acme");
      await seedAdmin(adminUsers, passwordHasher, {
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });

      const attempt = () =>
        useCase.execute({
          tenantKeyRaw: "acme",
          emailRaw: "owner@acme.example.com",
          password: "wrong",
          ip: "203.0.113.1",
          userAgent: "vitest",
          requestId: "req-1",
        });

      await expect(attempt()).rejects.toBeInstanceOf(AdminAuthenticationFailedError);
      await expect(attempt()).rejects.toBeInstanceOf(AdminAuthenticationFailedError);
      await expect(attempt()).rejects.toBeInstanceOf(AdminAuthenticationFailedError);

      // 4th attempt: now locked, even with the correct password.
      await expect(
        useCase.execute({
          tenantKeyRaw: "acme",
          emailRaw: "owner@acme.example.com",
          password: PASSWORD,
          ip: "203.0.113.1",
          userAgent: "vitest",
          requestId: "req-1",
        }),
      ).rejects.toBeInstanceOf(AdminTooManyAttemptsError);
    });

    it("resets the failure counter on a successful login", async () => {
      const { useCase, adminUsers, tenants, passwordHasher } = buildHarness({ maxFailures: 5 });
      const tenant = await seedTenant(tenants, "acme");
      await seedAdmin(adminUsers, passwordHasher, {
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });

      const wrongAttempt = () =>
        useCase.execute({
          tenantKeyRaw: "acme",
          emailRaw: "owner@acme.example.com",
          password: "wrong",
          ip: "203.0.113.1",
          userAgent: "vitest",
          requestId: "req-1",
        });
      await expect(wrongAttempt()).rejects.toThrow();
      await expect(wrongAttempt()).rejects.toThrow();

      await useCase.execute({
        tenantKeyRaw: "acme",
        emailRaw: "owner@acme.example.com",
        password: PASSWORD,
        ip: "203.0.113.1",
        userAgent: "vitest",
        requestId: "req-1",
      });

      const stored = await adminUsers.findByTenantAndEmail(
        tenant.id,
        anEmail("owner@acme.example.com"),
      );
      expect(stored?.failedLoginCount).toBe(0);
    });
  });

  describe("IP-level rate limiting", () => {
    it("rejects further attempts once the IP failure threshold is reached", async () => {
      const { useCase, tenants, adminUsers, passwordHasher } = buildHarness({
        ipMaxFailures: 2,
        maxFailures: 100,
      });
      const tenant = await seedTenant(tenants, "acme");
      await seedAdmin(adminUsers, passwordHasher, {
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });

      const attempt = () =>
        useCase.execute({
          tenantKeyRaw: "acme",
          emailRaw: "owner@acme.example.com",
          password: "wrong",
          ip: "203.0.113.9",
          userAgent: "vitest",
          requestId: "req-1",
        });

      await expect(attempt()).rejects.toBeInstanceOf(AdminAuthenticationFailedError);
      await expect(attempt()).rejects.toBeInstanceOf(AdminAuthenticationFailedError);
      // 3rd attempt from the same IP: rate limited, even before credentials are checked.
      await expect(attempt()).rejects.toBeInstanceOf(AdminTooManyAttemptsError);
    });

    it("does not rate-limit a different IP address", async () => {
      const { useCase, tenants, adminUsers, passwordHasher } = buildHarness({ ipMaxFailures: 1 });
      const tenant = await seedTenant(tenants, "acme");
      await seedAdmin(adminUsers, passwordHasher, {
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });

      await expect(
        useCase.execute({
          tenantKeyRaw: "acme",
          emailRaw: "owner@acme.example.com",
          password: "wrong",
          ip: "203.0.113.9",
          userAgent: "vitest",
          requestId: "req-1",
        }),
      ).rejects.toBeInstanceOf(AdminAuthenticationFailedError);

      const result = await useCase.execute({
        tenantKeyRaw: "acme",
        emailRaw: "owner@acme.example.com",
        password: PASSWORD,
        ip: "198.51.100.5",
        userAgent: "vitest",
        requestId: "req-1",
      });
      expect(result.admin.role).toBe("TENANT_OWNER");
    });
  });

  describe("Login event audit log", () => {
    it("never records the plaintext password or email", async () => {
      const { useCase, adminUsers, tenants, passwordHasher, loginEvents } = buildHarness();
      const tenant = await seedTenant(tenants, "acme");
      await seedAdmin(adminUsers, passwordHasher, {
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });

      await useCase.execute({
        tenantKeyRaw: "acme",
        emailRaw: "owner@acme.example.com",
        password: PASSWORD,
        ip: "203.0.113.1",
        userAgent: "vitest",
        requestId: "req-1",
      });

      expect(loginEvents.events).toHaveLength(1);
      const event = loginEvents.events[0];
      expect(event?.success).toBe(true);
      expect(event?.failureReason).toBeNull();
      const serialized = JSON.stringify(event);
      expect(serialized).not.toContain(PASSWORD);
      expect(serialized).not.toContain("owner@acme.example.com");
    });

    it("records a failure event with the specific reason server-side only", async () => {
      const { useCase, tenants, loginEvents } = buildHarness();
      await seedTenant(tenants, "acme");

      await expect(
        useCase.execute({
          tenantKeyRaw: "acme",
          emailRaw: "nobody@acme.example.com",
          password: PASSWORD,
          ip: "203.0.113.1",
          userAgent: "vitest",
          requestId: "req-1",
        }),
      ).rejects.toThrow();

      expect(loginEvents.events).toHaveLength(1);
      expect(loginEvents.events[0]?.success).toBe(false);
      expect(loginEvents.events[0]?.failureReason).toBe("INVALID_CREDENTIALS");
    });
  });
});
