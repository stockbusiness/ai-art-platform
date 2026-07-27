import { randomUUID } from "node:crypto";

import { createPrismaClient, type PrismaClient } from "@ai-art-platform/database";
import {
  PrimaryTenantDomainAlreadyExistsError,
  Tenant,
  TenantDomainAlreadyExistsError,
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
      host: "acme.example.com",
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
      host: "dup.example.com",
      isPrimary: false,
    });

    await expect(
      repository.addTenantDomain({
        tenantId: tenant.id,
        host: "dup.example.com",
        isPrimary: false,
      }),
    ).rejects.toBeInstanceOf(TenantDomainAlreadyExistsError);
  });

  it("rejects a second primary domain for the same tenant", async () => {
    const tenant = newTenant("dup-primary");
    await repository.create(tenant);
    await repository.addTenantDomain({
      tenantId: tenant.id,
      host: "primary-one.example.com",
      isPrimary: true,
    });

    await expect(
      repository.addTenantDomain({
        tenantId: tenant.id,
        host: "primary-two.example.com",
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
});
