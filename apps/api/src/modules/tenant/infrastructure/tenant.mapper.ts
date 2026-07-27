import type { Prisma } from "@ai-art-platform/database";
import { Tenant, TenantKey } from "@ai-art-platform/domain";

type PersistedTenant = {
  id: string;
  tenantKey: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED";
  timezone: string;
  defaultLocale: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Prisma row -> Domain entity. Throws if a stored tenantKey somehow fails domain validation. */
export function toDomainTenant(row: PersistedTenant): Tenant {
  const tenantKeyResult = TenantKey.create(row.tenantKey);
  if (!tenantKeyResult.ok) {
    throw tenantKeyResult.error;
  }
  return Tenant.reconstitute({
    id: row.id,
    tenantKey: tenantKeyResult.value,
    name: row.name,
    status: row.status,
    timezone: row.timezone,
    defaultLocale: row.defaultLocale,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/** Domain entity -> Prisma create input. */
export function toCreateInput(tenant: Tenant): Prisma.TenantCreateInput {
  return {
    id: tenant.id,
    tenantKey: tenant.tenantKey.toString(),
    name: tenant.name,
    status: tenant.status,
    timezone: tenant.timezone,
    defaultLocale: tenant.defaultLocale,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  };
}

/** Domain entity -> Prisma update input (id is used as the where clause, not the payload). */
export function toUpdateInput(tenant: Tenant): Prisma.TenantUpdateInput {
  return {
    name: tenant.name,
    status: tenant.status,
    timezone: tenant.timezone,
    defaultLocale: tenant.defaultLocale,
    updatedAt: tenant.updatedAt,
  };
}
