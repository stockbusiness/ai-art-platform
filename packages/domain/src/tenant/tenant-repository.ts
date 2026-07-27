import type { TenantKey } from "./tenant-key.js";
import type { Tenant } from "./tenant.js";

/**
 * DI token for TenantRepository. A plain value (not a NestJS decorator or
 * class), so domain stays framework-free while still giving apps/api's
 * NestJS container something concrete to bind the Prisma-backed adapter to
 * — TypeScript interfaces don't exist at runtime, so they can't be used as
 * an injection token by themselves.
 */
export const TENANT_REPOSITORY = "TENANT_REPOSITORY";

export interface CreateTenantDomainInput {
  tenantId: string;
  host: string;
  isPrimary: boolean;
}

export interface UpsertTenantSettingInput {
  tenantId: string;
  key: string;
  valueJson: unknown;
  isSecret: boolean;
}

/**
 * Port for Tenant aggregate persistence. Implemented in
 * apps/api/src/modules/tenant/infrastructure by a Prisma-backed adapter —
 * this interface itself must stay free of Prisma/HTTP types so the domain
 * layer never depends on them.
 *
 * TenantDomain and TenantSetting are child records of the Tenant aggregate;
 * PR-02 exposes no HTTP API for them (see section 13.4), so they are only
 * reachable through this port for now — Unit/Integration tests call it
 * directly.
 */
export interface TenantRepository {
  findById(id: string): Promise<Tenant | null>;
  findByTenantKey(tenantKey: TenantKey): Promise<Tenant | null>;
  /** Throws TenantKeyAlreadyExistsError on a duplicate tenantKey. */
  create(tenant: Tenant): Promise<void>;
  update(tenant: Tenant): Promise<void>;
  /**
   * Throws TenantDomainAlreadyExistsError on a duplicate host, or
   * PrimaryTenantDomainAlreadyExistsError when `isPrimary` is true and the
   * tenant already has a primary domain.
   */
  addTenantDomain(input: CreateTenantDomainInput): Promise<void>;
  /** Upserts by the (tenantId, key) unique constraint. */
  upsertTenantSetting(input: UpsertTenantSettingInput): Promise<void>;
}
