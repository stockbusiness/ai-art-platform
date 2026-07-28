import { randomUUID } from "node:crypto";

import { createPrismaClient, type PrismaClient } from "@ai-art-platform/database";
import {
  AdminAlreadyExistsError,
  AdminEmail,
  AdminName,
  AdminSession,
  AdminUser,
  Tenant,
  TenantKey,
} from "@ai-art-platform/domain";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaService } from "../../src/infrastructure/database/prisma.service.js";
import { PrismaAdminLoginEventRepository } from "../../src/modules/admin-auth/infrastructure/prisma-admin-login-event.repository.js";
import { PrismaAdminSessionRepository } from "../../src/modules/admin-auth/infrastructure/prisma-admin-session.repository.js";
import { PrismaAdminUserRepository } from "../../src/modules/admin-auth/infrastructure/prisma-admin-user.repository.js";
import { PrismaTenantRepository } from "../../src/modules/tenant/infrastructure/prisma-tenant.repository.js";

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

function newTenant(tenantKeyRaw: string): Tenant {
  const tenantKeyResult = TenantKey.create(tenantKeyRaw);
  if (!tenantKeyResult.ok) throw tenantKeyResult.error;
  return Tenant.create({
    id: randomUUID(),
    tenantKey: tenantKeyResult.value,
    name: "T",
    now: new Date(),
  });
}

function newAdmin(input: {
  tenantId: string | null;
  email: string;
  role: "SUPER_ADMIN" | "TENANT_OWNER";
}): AdminUser {
  return AdminUser.create({
    id: randomUUID(),
    tenantId: input.tenantId,
    email: anEmail(input.email),
    passwordHash: "fake-hash",
    name: aName("Admin"),
    role: input.role,
    now: new Date(),
  });
}

describe("Admin Auth Repositories (section 13.2)", () => {
  const prismaService = new PrismaService();
  const tenantRepository = new PrismaTenantRepository(prismaService);
  const adminUserRepository = new PrismaAdminUserRepository(prismaService);
  const adminSessionRepository = new PrismaAdminSessionRepository(prismaService);
  const adminLoginEventRepository = new PrismaAdminLoginEventRepository(prismaService);
  const client: PrismaClient = createPrismaClient();

  beforeEach(async () => {
    await client.adminLoginEvent.deleteMany();
    await client.adminSession.deleteMany();
    await client.adminUser.deleteMany();
    await client.tenantSetting.deleteMany();
    await client.tenantDomain.deleteMany();
    await client.tenant.deleteMany();
  });

  afterAll(async () => {
    await client.$disconnect();
    await prismaService.client.$disconnect();
  });

  it("Migration applied: admin_users/admin_sessions/admin_login_events all exist", async () => {
    // A successful query against each table (rather than introspecting
    // information_schema) is the most direct proof the migration applied.
    await expect(client.adminUser.count()).resolves.toBe(0);
    await expect(client.adminSession.count()).resolves.toBe(0);
    await expect(client.adminLoginEvent.count()).resolves.toBe(0);
  });

  describe("AdminUser persistence", () => {
    it("creates and finds a Tenant-scoped admin by (tenantId, email)", async () => {
      const tenant = newTenant("acme");
      await tenantRepository.create(tenant);
      const admin = newAdmin({
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });

      await adminUserRepository.create(admin);
      const found = await adminUserRepository.findByTenantAndEmail(
        tenant.id,
        anEmail("owner@acme.example.com"),
      );

      expect(found?.id).toBe(admin.id);
      expect(found?.role).toBe("TENANT_OWNER");
    });

    it("creates and finds a SUPER_ADMIN by email (tenantId IS NULL)", async () => {
      const admin = newAdmin({ tenantId: null, email: "root@example.com", role: "SUPER_ADMIN" });

      await adminUserRepository.create(admin);
      const found = await adminUserRepository.findSuperAdminByEmail(anEmail("root@example.com"));

      expect(found?.id).toBe(admin.id);
    });

    it("rejects a duplicate email within the same Tenant", async () => {
      const tenant = newTenant("acme");
      await tenantRepository.create(tenant);
      await adminUserRepository.create(
        newAdmin({ tenantId: tenant.id, email: "owner@acme.example.com", role: "TENANT_OWNER" }),
      );

      await expect(
        adminUserRepository.create(
          newAdmin({ tenantId: tenant.id, email: "owner@acme.example.com", role: "TENANT_OWNER" }),
        ),
      ).rejects.toBeInstanceOf(AdminAlreadyExistsError);
    });

    it("allows the same email across two different Tenants", async () => {
      const tenantA = newTenant("acme");
      const tenantB = newTenant("globex");
      await tenantRepository.create(tenantA);
      await tenantRepository.create(tenantB);

      await adminUserRepository.create(
        newAdmin({ tenantId: tenantA.id, email: "shared@example.com", role: "TENANT_OWNER" }),
      );
      await expect(
        adminUserRepository.create(
          newAdmin({ tenantId: tenantB.id, email: "shared@example.com", role: "TENANT_OWNER" }),
        ),
      ).resolves.toBeUndefined();
    });

    it("rejects a duplicate SUPER_ADMIN email", async () => {
      await adminUserRepository.create(
        newAdmin({ tenantId: null, email: "root@example.com", role: "SUPER_ADMIN" }),
      );

      await expect(
        adminUserRepository.create(
          newAdmin({ tenantId: null, email: "root@example.com", role: "SUPER_ADMIN" }),
        ),
      ).rejects.toBeInstanceOf(AdminAlreadyExistsError);
    });

    it("allows a Tenant admin and a SUPER_ADMIN to share the same email", async () => {
      const tenant = newTenant("acme");
      await tenantRepository.create(tenant);
      await adminUserRepository.create(
        newAdmin({ tenantId: tenant.id, email: "shared@example.com", role: "TENANT_OWNER" }),
      );

      await expect(
        adminUserRepository.create(
          newAdmin({ tenantId: null, email: "shared@example.com", role: "SUPER_ADMIN" }),
        ),
      ).resolves.toBeUndefined();
    });

    it("persists lockout state changes via update()", async () => {
      const tenant = newTenant("acme");
      await tenantRepository.create(tenant);
      const admin = newAdmin({
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });
      await adminUserRepository.create(admin);

      admin.recordFailedLogin(new Date(), 5, 900);
      admin.recordFailedLogin(new Date(), 5, 900);
      await adminUserRepository.update(admin);

      const reloaded = await adminUserRepository.findById(admin.id);
      expect(reloaded?.failedLoginCount).toBe(2);
    });
  });

  describe("DB-level CHECK constraints (bypassing the domain layer via raw SQL)", () => {
    const POSTGRES_CHECK_VIOLATION = "23514";

    async function expectCheckViolation(promise: Promise<unknown>): Promise<void> {
      await expect(promise).rejects.toMatchObject({
        meta: { code: POSTGRES_CHECK_VIOLATION },
      });
    }

    async function rawInsertAdminUser(overrides: {
      tenantId?: string | null;
      email: string;
      role?: string;
    }): Promise<unknown> {
      return client.$executeRawUnsafe(
        `INSERT INTO "admin_users" (id, tenant_id, email, password_hash, name, role, status, updated_at)
         VALUES (gen_random_uuid(), $1::uuid, $2, 'hash', 'Name', $3::"AdminRole", 'ACTIVE', now())`,
        overrides.tenantId ?? null,
        overrides.email,
        overrides.role ?? "TENANT_OWNER",
      );
    }

    it("rejects a Tenant-role admin_user with tenant_id NULL", async () => {
      await expectCheckViolation(
        rawInsertAdminUser({ tenantId: null, email: "x@example.com", role: "TENANT_OWNER" }),
      );
    });

    it("rejects a SUPER_ADMIN admin_user with tenant_id NOT NULL", async () => {
      const tenant = newTenant("acme");
      await tenantRepository.create(tenant);
      await expectCheckViolation(
        rawInsertAdminUser({ tenantId: tenant.id, email: "x@example.com", role: "SUPER_ADMIN" }),
      );
    });

    it("rejects an uppercase email", async () => {
      const tenant = newTenant("acme");
      await tenantRepository.create(tenant);
      await expectCheckViolation(
        rawInsertAdminUser({
          tenantId: tenant.id,
          email: "Upper@Example.com",
          role: "TENANT_OWNER",
        }),
      );
    });

    it("rejects an email with leading/trailing whitespace", async () => {
      const tenant = newTenant("acme");
      await tenantRepository.create(tenant);
      await expectCheckViolation(
        rawInsertAdminUser({ tenantId: tenant.id, email: " x@example.com", role: "TENANT_OWNER" }),
      );
    });

    it("rejects an empty name", async () => {
      const tenant = newTenant("acme");
      await tenantRepository.create(tenant);
      await expectCheckViolation(
        client.$executeRawUnsafe(
          `INSERT INTO "admin_users" (id, tenant_id, email, password_hash, name, role, status, updated_at)
           VALUES (gen_random_uuid(), $1::uuid, 'x@example.com', 'hash', '', 'TENANT_OWNER', 'ACTIVE', now())`,
          tenant.id,
        ),
      );
    });

    it("rejects a negative failed_login_count", async () => {
      const tenant = newTenant("acme");
      await tenantRepository.create(tenant);
      await expectCheckViolation(
        client.$executeRawUnsafe(
          `INSERT INTO "admin_users" (id, tenant_id, email, password_hash, name, role, status, failed_login_count, updated_at)
           VALUES (gen_random_uuid(), $1::uuid, 'x@example.com', 'hash', 'Name', 'TENANT_OWNER', 'ACTIVE', -1, now())`,
          tenant.id,
        ),
      );
    });

    it("the partial unique index rejects a raw-SQL duplicate (tenant_id, email)", async () => {
      const tenant = newTenant("acme");
      await tenantRepository.create(tenant);
      await rawInsertAdminUser({ tenantId: tenant.id, email: "dup@example.com" });

      await expect(
        rawInsertAdminUser({ tenantId: tenant.id, email: "dup@example.com" }),
      ).rejects.toMatchObject({
        meta: { code: "23505" },
      });
    });

    it("accepts a valid admin_users row", async () => {
      const tenant = newTenant("acme");
      await tenantRepository.create(tenant);
      await expect(
        rawInsertAdminUser({
          tenantId: tenant.id,
          email: "valid@example.com",
          role: "TENANT_OWNER",
        }),
      ).resolves.toBeDefined();
    });
  });

  describe("AdminSession persistence", () => {
    it("rejects a duplicate token_hash", async () => {
      const tenant = newTenant("acme");
      await tenantRepository.create(tenant);
      const admin = newAdmin({
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });
      await adminUserRepository.create(admin);

      const sessionA = AdminSession.create({
        id: randomUUID(),
        adminUserId: admin.id,
        tokenHash: "same-hash",
        csrfTokenHash: "csrf-a",
        ipHash: null,
        userAgentHash: null,
        now: new Date(),
        ttlSeconds: 3600,
      });
      const sessionB = AdminSession.create({
        id: randomUUID(),
        adminUserId: admin.id,
        tokenHash: "same-hash",
        csrfTokenHash: "csrf-b",
        ipHash: null,
        userAgentHash: null,
        now: new Date(),
        ttlSeconds: 3600,
      });

      await adminSessionRepository.create(sessionA);
      await expect(adminSessionRepository.create(sessionB)).rejects.toThrow();
    });

    it("persists revocation via update()", async () => {
      const tenant = newTenant("acme");
      await tenantRepository.create(tenant);
      const admin = newAdmin({
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });
      await adminUserRepository.create(admin);
      const session = AdminSession.create({
        id: randomUUID(),
        adminUserId: admin.id,
        tokenHash: "token-hash-1",
        csrfTokenHash: "csrf-1",
        ipHash: null,
        userAgentHash: null,
        now: new Date(),
        ttlSeconds: 3600,
      });
      await adminSessionRepository.create(session);

      session.revoke(new Date(), "USER_LOGOUT");
      await adminSessionRepository.update(session);

      const reloaded = await adminSessionRepository.findByTokenHash("token-hash-1");
      expect(reloaded?.isRevoked()).toBe(true);
    });
  });

  describe("AdminLoginEvent audit log", () => {
    it("never stores plaintext email/IP/User-Agent — only hashes", async () => {
      const tenant = newTenant("acme");
      await tenantRepository.create(tenant);
      const admin = newAdmin({
        tenantId: tenant.id,
        email: "owner@acme.example.com",
        role: "TENANT_OWNER",
      });
      await adminUserRepository.create(admin);

      await adminLoginEventRepository.record({
        id: randomUUID(),
        adminUserId: admin.id,
        tenantId: tenant.id,
        emailHash: "e".repeat(64),
        success: true,
        failureReason: null,
        ipHash: "i".repeat(64),
        userAgentHash: "u".repeat(64),
        requestId: randomUUID(),
        now: new Date(),
      });

      const row = await client.adminLoginEvent.findFirstOrThrow({
        where: { adminUserId: admin.id },
      });
      const serialized = JSON.stringify(row);
      expect(serialized).not.toContain("owner@acme.example.com");
      expect(serialized).not.toContain("203.0.113");
      expect(row.emailHash).toBe("e".repeat(64));
    });

    it("counts recent failures by ipHash within the window and excludes older/other events", async () => {
      const now = new Date("2026-01-01T00:30:00Z");
      const record = (overrides: { ipHash: string; success: boolean; now: Date }) =>
        adminLoginEventRepository.record({
          id: randomUUID(),
          adminUserId: null,
          tenantId: null,
          emailHash: "e".repeat(64),
          success: overrides.success,
          failureReason: overrides.success ? null : "INVALID_CREDENTIALS",
          ipHash: overrides.ipHash,
          userAgentHash: null,
          requestId: randomUUID(),
          now: overrides.now,
        });

      await record({ ipHash: "target-ip", success: false, now: new Date("2026-01-01T00:20:00Z") }); // within window
      await record({ ipHash: "target-ip", success: false, now: new Date("2025-12-31T00:00:00Z") }); // too old
      await record({ ipHash: "target-ip", success: true, now: new Date("2026-01-01T00:25:00Z") }); // success, not counted
      await record({ ipHash: "other-ip", success: false, now: new Date("2026-01-01T00:25:00Z") }); // different IP

      const count = await adminLoginEventRepository.countRecentFailuresByIpHash(
        "target-ip",
        now,
        15 * 60,
      );
      expect(count).toBe(1);
    });
  });
});
