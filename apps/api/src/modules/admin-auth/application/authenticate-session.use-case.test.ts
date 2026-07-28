import { randomUUID } from "node:crypto";

import {
  AdminEmail,
  AdminForbiddenError,
  AdminName,
  AdminSession,
  AdminUnauthenticatedError,
  AdminUser,
  Tenant,
  TenantKey,
} from "@ai-art-platform/domain";
import { describe, expect, it } from "vitest";

import { InMemoryTenantRepository } from "../../tenant/application/test-fixtures/in-memory-tenant.repository.js";

import { AuthenticateSessionUseCase } from "./authenticate-session.use-case.js";
import { FakeSessionTokenService } from "./test-fixtures/fake-session-token.service.js";
import { FixedAuthClock } from "./test-fixtures/fixed-auth-clock.js";
import { InMemoryAdminSessionRepository } from "./test-fixtures/in-memory-admin-session.repository.js";
import { InMemoryAdminUserRepository } from "./test-fixtures/in-memory-admin-user.repository.js";

const NOW = new Date("2026-01-01T00:00:00Z");

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

function buildHarness() {
  const sessions = new InMemoryAdminSessionRepository();
  const adminUsers = new InMemoryAdminUserRepository();
  const tenants = new InMemoryTenantRepository();
  const sessionTokens = new FakeSessionTokenService();
  const clock = new FixedAuthClock(NOW);
  const useCase = new AuthenticateSessionUseCase(
    sessions,
    adminUsers,
    tenants,
    sessionTokens,
    clock,
  );
  return { useCase, sessions, adminUsers, tenants, sessionTokens, clock };
}

async function seedTenant(tenants: InMemoryTenantRepository, key = "acme"): Promise<Tenant> {
  const tenantKeyResult = TenantKey.create(key);
  if (!tenantKeyResult.ok) throw tenantKeyResult.error;
  const tenant = Tenant.create({
    id: randomUUID(),
    tenantKey: tenantKeyResult.value,
    name: "T",
    now: NOW,
  });
  await tenants.create(tenant);
  return tenant;
}

async function seedAdminWithSession(
  adminUsers: InMemoryAdminUserRepository,
  sessions: InMemoryAdminSessionRepository,
  sessionTokens: FakeSessionTokenService,
  input: { tenantId: string | null; role: "SUPER_ADMIN" | "TENANT_OWNER" },
): Promise<{ admin: AdminUser; rawToken: string }> {
  const admin = AdminUser.create({
    id: randomUUID(),
    tenantId: input.tenantId,
    email: anEmail("admin@example.com"),
    passwordHash: "hash",
    name: aName("Admin"),
    role: input.role,
    now: NOW,
  });
  await adminUsers.create(admin);

  const token = sessionTokens.generateSessionToken();
  const csrf = sessionTokens.generateCsrfToken();
  const session = AdminSession.create({
    id: randomUUID(),
    adminUserId: admin.id,
    tokenHash: token.hash,
    csrfTokenHash: csrf.hash,
    ipHash: null,
    userAgentHash: null,
    now: NOW,
    ttlSeconds: 3600,
  });
  await sessions.create(session);

  return { admin, rawToken: token.raw };
}

describe("AuthenticateSessionUseCase", () => {
  it("resolves a valid Tenant-scoped session", async () => {
    const { useCase, adminUsers, sessions, tenants, sessionTokens } = buildHarness();
    const tenant = await seedTenant(tenants);
    const { rawToken } = await seedAdminWithSession(adminUsers, sessions, sessionTokens, {
      tenantId: tenant.id,
      role: "TENANT_OWNER",
    });

    const context = await useCase.execute(rawToken);

    expect(context.tenantId).toBe(tenant.id);
    expect(context.tenantKey).toBe("acme");
    expect(context.role).toBe("TENANT_OWNER");
    expect(context.permissions).toContain("tenant:read");
  });

  it("resolves a valid SUPER_ADMIN session with a null tenant context", async () => {
    const { useCase, adminUsers, sessions, sessionTokens } = buildHarness();
    const { rawToken } = await seedAdminWithSession(adminUsers, sessions, sessionTokens, {
      tenantId: null,
      role: "SUPER_ADMIN",
    });

    const context = await useCase.execute(rawToken);

    expect(context.tenantId).toBeNull();
    expect(context.tenantKey).toBeNull();
    expect(context.role).toBe("SUPER_ADMIN");
  });

  it("rejects an unknown token", async () => {
    const { useCase } = buildHarness();
    await expect(useCase.execute("does-not-exist")).rejects.toBeInstanceOf(
      AdminUnauthenticatedError,
    );
  });

  it("rejects an expired session", async () => {
    const { useCase, adminUsers, sessions, tenants, sessionTokens, clock } = buildHarness();
    const tenant = await seedTenant(tenants);
    const { rawToken } = await seedAdminWithSession(adminUsers, sessions, sessionTokens, {
      tenantId: tenant.id,
      role: "TENANT_OWNER",
    });

    clock.advance(3600 * 1000 + 1);

    await expect(useCase.execute(rawToken)).rejects.toBeInstanceOf(AdminUnauthenticatedError);
  });

  it("rejects a revoked session", async () => {
    const { useCase, adminUsers, sessions, tenants, sessionTokens } = buildHarness();
    const tenant = await seedTenant(tenants);
    const { rawToken } = await seedAdminWithSession(adminUsers, sessions, sessionTokens, {
      tenantId: tenant.id,
      role: "TENANT_OWNER",
    });
    const tokenHash = sessionTokens.hash(rawToken);
    const session = await sessions.findByTokenHash(tokenHash);
    session?.revoke(NOW, "USER_LOGOUT");
    if (session) await sessions.update(session);

    await expect(useCase.execute(rawToken)).rejects.toBeInstanceOf(AdminUnauthenticatedError);
  });

  it("rejects a session belonging to a DISABLED admin", async () => {
    const { useCase, adminUsers, sessions, tenants, sessionTokens } = buildHarness();
    const tenant = await seedTenant(tenants);
    const { admin, rawToken } = await seedAdminWithSession(adminUsers, sessions, sessionTokens, {
      tenantId: tenant.id,
      role: "TENANT_OWNER",
    });
    const disabled = AdminUser.reconstitute({
      id: admin.id,
      tenantId: admin.tenantId,
      email: admin.email,
      passwordHash: admin.passwordHash,
      name: admin.name,
      role: admin.role,
      status: "DISABLED",
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: null,
      passwordChangedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    });
    await adminUsers.update(disabled);

    await expect(useCase.execute(rawToken)).rejects.toBeInstanceOf(AdminUnauthenticatedError);
  });

  it("rejects a session whose Tenant is SUSPENDED with a Forbidden error", async () => {
    const { useCase, adminUsers, sessions, tenants, sessionTokens } = buildHarness();
    const tenant = await seedTenant(tenants);
    const { rawToken } = await seedAdminWithSession(adminUsers, sessions, sessionTokens, {
      tenantId: tenant.id,
      role: "TENANT_OWNER",
    });
    tenant.changeStatus("SUSPENDED", NOW);
    await tenants.update(tenant);

    await expect(useCase.execute(rawToken)).rejects.toBeInstanceOf(AdminForbiddenError);
  });

  it("touches lastSeenAt only once the minimum interval has elapsed", async () => {
    const { useCase, adminUsers, sessions, tenants, sessionTokens, clock } = buildHarness();
    const tenant = await seedTenant(tenants);
    const { rawToken } = await seedAdminWithSession(adminUsers, sessions, sessionTokens, {
      tenantId: tenant.id,
      role: "TENANT_OWNER",
    });
    const tokenHash = sessionTokens.hash(rawToken);
    const before = (await sessions.findByTokenHash(tokenHash))?.lastSeenAt;

    clock.advance(60 * 1000); // 1 minute — below the 5-minute touch interval
    await useCase.execute(rawToken);
    const afterShort = (await sessions.findByTokenHash(tokenHash))?.lastSeenAt;
    expect(afterShort).toEqual(before);

    clock.advance(5 * 60 * 1000); // now well past the interval
    await useCase.execute(rawToken);
    const afterLong = (await sessions.findByTokenHash(tokenHash))?.lastSeenAt;
    expect(afterLong).not.toEqual(before);
  });
});
