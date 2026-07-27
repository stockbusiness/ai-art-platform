import { randomUUID } from "node:crypto";

import { createPrismaClient, type PrismaClient } from "@ai-art-platform/database";
import {
  PrimaryTenantDomainAlreadyExistsError,
  Tenant,
  TenantDomainAlreadyExistsError,
  TenantDomainHost,
  TenantKey,
  TenantKeyAlreadyExistsError,
} from "@ai-art-platform/domain";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaService } from "../../src/infrastructure/database/prisma.service.js";
import { PrismaTenantRepository } from "../../src/modules/tenant/infrastructure/prisma-tenant.repository.js";

function aTenantKey(raw: string): TenantKey {
  const result = TenantKey.create(raw);
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}

function aHost(raw: string): TenantDomainHost {
  const result = TenantDomainHost.create(raw);
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}

function newTenant(tenantKeyRaw: string, name = "Test Tenant"): Tenant {
  return Tenant.create({
    id: randomUUID(),
    tenantKey: aTenantKey(tenantKeyRaw),
    name,
    now: new Date(),
  });
}

describe("PrismaTenantRepository", () => {
  const prismaService = new PrismaService();
  const repository = new PrismaTenantRepository(prismaService);
  const client: PrismaClient = createPrismaClient();

  beforeEach(async () => {
    await client.tenantSetting.deleteMany();
    await client.tenantDomain.deleteMany();
    await client.tenant.deleteMany();
  });

  afterAll(async () => {
    await client.$disconnect();
    await prismaService.client.$disconnect();
  });

  it("creates and finds a tenant by id and by tenantKey", async () => {
    const tenant = newTenant("acme");
    await repository.create(tenant);

    const byId = await repository.findById(tenant.id);
    const byKey = await repository.findByTenantKey(aTenantKey("acme"));

    expect(byId?.id).toBe(tenant.id);
    expect(byKey?.id).toBe(tenant.id);
  });

  it("rejects a duplicate tenantKey", async () => {
    await repository.create(newTenant("dup-key"));

    await expect(repository.create(newTenant("dup-key"))).rejects.toBeInstanceOf(
      TenantKeyAlreadyExistsError,
    );
  });

  it("updates a tenant (name and status)", async () => {
    const tenant = newTenant("update-me");
    await repository.create(tenant);

    tenant.rename("Renamed", new Date());
    tenant.changeStatus("SUSPENDED", new Date());
    await repository.update(tenant);

    const reloaded = await repository.findById(tenant.id);
    expect(reloaded?.name).toBe("Renamed");
    expect(reloaded?.status).toBe("SUSPENDED");
  });

  it("creates a tenant domain", async () => {
    const tenant = newTenant("with-domain");
    await repository.create(tenant);

    await repository.addTenantDomain({
      tenantId: tenant.id,
      host: aHost("acme.example.com"),
      isPrimary: false,
    });

    const row = await client.tenantDomain.findUnique({ where: { host: "acme.example.com" } });
    expect(row?.tenantId).toBe(tenant.id);
  });

  it("rejects a duplicate domain host", async () => {
    const tenant = newTenant("dup-domain");
    await repository.create(tenant);
    await repository.addTenantDomain({
      tenantId: tenant.id,
      host: aHost("dup.example.com"),
      isPrimary: false,
    });

    await expect(
      repository.addTenantDomain({
        tenantId: tenant.id,
        host: aHost("dup.example.com"),
        isPrimary: false,
      }),
    ).rejects.toBeInstanceOf(TenantDomainAlreadyExistsError);
  });

  it("treats hosts differing only by case as the same host", async () => {
    const tenant = newTenant("case-domain");
    await repository.create(tenant);
    await repository.addTenantDomain({
      tenantId: tenant.id,
      host: aHost("Example.com"),
      isPrimary: false,
    });

    await expect(
      repository.addTenantDomain({
        tenantId: tenant.id,
        host: aHost("EXAMPLE.COM"),
        isPrimary: false,
      }),
    ).rejects.toBeInstanceOf(TenantDomainAlreadyExistsError);

    const row = await client.tenantDomain.findUnique({ where: { host: "example.com" } });
    expect(row).not.toBeNull();
  });

  it("rejects a second primary domain for the same tenant", async () => {
    const tenant = newTenant("dup-primary");
    await repository.create(tenant);
    await repository.addTenantDomain({
      tenantId: tenant.id,
      host: aHost("primary-one.example.com"),
      isPrimary: true,
    });

    await expect(
      repository.addTenantDomain({
        tenantId: tenant.id,
        host: aHost("primary-two.example.com"),
        isPrimary: true,
      }),
    ).rejects.toBeInstanceOf(PrimaryTenantDomainAlreadyExistsError);
  });

  it("upserts a tenant setting and enforces the (tenantId, key) constraint via idempotent upsert", async () => {
    const tenant = newTenant("with-setting");
    await repository.create(tenant);

    await repository.upsertTenantSetting({
      tenantId: tenant.id,
      key: "theme",
      valueJson: { color: "blue" },
      isSecret: false,
    });
    await repository.upsertTenantSetting({
      tenantId: tenant.id,
      key: "theme",
      valueJson: { color: "red" },
      isSecret: false,
    });

    const rows = await client.tenantSetting.findMany({
      where: { tenantId: tenant.id, key: "theme" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.valueJson).toEqual({ color: "red" });
  });

  it("seed is idempotent: upserting the same tenantKey twice yields one row", async () => {
    const seedInput = { tenantKeyRaw: "default", name: "AIアート教室" };
    for (let i = 0; i < 2; i += 1) {
      await client.tenant.upsert({
        where: { tenantKey: seedInput.tenantKeyRaw },
        update: { name: seedInput.name },
        create: {
          tenantKey: seedInput.tenantKeyRaw,
          name: seedInput.name,
          status: "ACTIVE",
          timezone: "Asia/Tokyo",
          defaultLocale: "ja-JP",
        },
      });
    }

    const rows = await client.tenant.findMany({ where: { tenantKey: "default" } });
    expect(rows).toHaveLength(1);
  });

  describe("DB-level CHECK constraints (bypassing the domain layer via raw SQL)", () => {
    const POSTGRES_CHECK_VIOLATION = "23514";
    // Postgres's own VARCHAR(n) length limit ("string data right
    // truncation") — a 51-character tenant_key is rejected by the column
    // type itself before the CHECK constraint's regex is ever evaluated.
    const POSTGRES_STRING_TOO_LONG = "22001";

    /**
     * Asserts the insert was rejected specifically by a Postgres CHECK
     * constraint (SQLSTATE 23514) — not by some unrelated failure (a type
     * mismatch, a missing column, ...) that `.rejects.toThrow()` alone
     * would not distinguish from an actual constraint violation.
     */
    async function expectCheckViolation(promise: Promise<unknown>): Promise<void> {
      await expect(promise).rejects.toMatchObject({
        meta: { code: POSTGRES_CHECK_VIOLATION },
      });
    }

    /** Same as expectCheckViolation, but also accepts a column-length rejection. */
    async function expectRejectedByDbConstraint(promise: Promise<unknown>): Promise<void> {
      let sqlstate: unknown;
      try {
        await promise;
      } catch (error: unknown) {
        sqlstate = (error as { meta?: { code?: unknown } }).meta?.code;
        expect([POSTGRES_CHECK_VIOLATION, POSTGRES_STRING_TOO_LONG]).toContain(sqlstate);
        return;
      }
      throw new Error("Expected the insert to be rejected, but it succeeded");
    }

    async function rawInsertTenant(tenantKey: string, name = "Raw Insert Test"): Promise<unknown> {
      return client.$executeRawUnsafe(
        `INSERT INTO "tenants" (id, tenant_key, name, status, timezone, default_locale, updated_at)
         VALUES (gen_random_uuid(), $1, $2, 'ACTIVE', 'Asia/Tokyo', 'ja-JP', now())`,
        tenantKey,
        name,
      );
    }

    it.each([
      ["ab", "too short (2 chars)"],
      ["Default", "contains uppercase"],
      ["-default", "leading hyphen"],
      ["default-", "trailing hyphen"],
      ["default_key", "invalid character (underscore)"],
    ])("rejects tenant_key = %s (%s) at the database level", async (invalidKey) => {
      await expectCheckViolation(rawInsertTenant(invalidKey));
    });

    it("rejects a tenant_key over 50 characters at the database level", async () => {
      await expectRejectedByDbConstraint(rawInsertTenant("a".repeat(51)));
    });

    it("accepts a valid tenant_key at the database level", async () => {
      await expect(rawInsertTenant("valid-key")).resolves.toBeDefined();
    });

    it.each([
      ["", "empty"],
      ["   ", "whitespace-only"],
    ])("rejects tenant name = %j (%s) at the database level", async (invalidName) => {
      await expectCheckViolation(rawInsertTenant("name-check-target", invalidName));
    });

    async function rawInsertTenantDomain(host: string): Promise<unknown> {
      const tenant = newTenant(`host-check-${randomUUID().slice(0, 8)}`);
      await repository.create(tenant);
      return client.$executeRawUnsafe(
        `INSERT INTO "tenant_domains" (id, tenant_id, host, is_primary, updated_at)
         VALUES (gen_random_uuid(), $1::uuid, $2, false, now())`,
        tenant.id,
        host,
      );
    }

    it.each([
      ["Example.com", "contains uppercase"],
      ["https://example.com", "contains a scheme"],
      ["example.com/path", "contains a path"],
      ["example.com:8080", "contains a port"],
      ["", "empty"],
      ["exa mple.com", "contains a space"],
    ])("rejects tenant_domains.host = %j (%s) at the database level", async (invalidHost) => {
      await expectCheckViolation(rawInsertTenantDomain(invalidHost));
    });

    it("accepts a valid tenant_domains.host at the database level", async () => {
      await expect(rawInsertTenantDomain("valid-host.example.com")).resolves.toBeDefined();
    });
  });
});
