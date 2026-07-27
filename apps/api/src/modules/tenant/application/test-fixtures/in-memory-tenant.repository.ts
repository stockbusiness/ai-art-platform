import {
  PrimaryTenantDomainAlreadyExistsError,
  TenantDomainAlreadyExistsError,
  TenantKeyAlreadyExistsError,
  type CreateTenantDomainInput,
  type Tenant,
  type TenantKey,
  type TenantRepository,
  type UpsertTenantSettingInput,
} from "@ai-art-platform/domain";

/** In-memory TenantRepository test double — no Prisma, no NestJS, no real DB. */
export class InMemoryTenantRepository implements TenantRepository {
  private tenants = new Map<string, Tenant>();
  private domainsByHost = new Map<string, { tenantId: string; isPrimary: boolean }>();
  private primaryDomainByTenant = new Set<string>();
  private settings = new Map<string, unknown>();

  findById(id: string): Promise<Tenant | null> {
    return Promise.resolve(this.tenants.get(id) ?? null);
  }

  findByTenantKey(tenantKey: TenantKey): Promise<Tenant | null> {
    for (const tenant of this.tenants.values()) {
      if (tenant.tenantKey.equals(tenantKey)) {
        return Promise.resolve(tenant);
      }
    }
    return Promise.resolve(null);
  }

  async create(tenant: Tenant): Promise<void> {
    const existing = await this.findByTenantKey(tenant.tenantKey);
    if (existing) {
      throw new TenantKeyAlreadyExistsError(
        `Tenant key "${tenant.tenantKey.toString()}" already exists`,
      );
    }
    this.tenants.set(tenant.id, tenant);
  }

  update(tenant: Tenant): Promise<void> {
    this.tenants.set(tenant.id, tenant);
    return Promise.resolve();
  }

  addTenantDomain(input: CreateTenantDomainInput): Promise<void> {
    const host = input.host.toString();
    if (this.domainsByHost.has(host)) {
      throw new TenantDomainAlreadyExistsError(`Domain "${host}" already exists`);
    }
    if (input.isPrimary && this.primaryDomainByTenant.has(input.tenantId)) {
      throw new PrimaryTenantDomainAlreadyExistsError(
        `Tenant ${input.tenantId} already has a primary domain`,
      );
    }
    this.domainsByHost.set(host, { tenantId: input.tenantId, isPrimary: input.isPrimary });
    if (input.isPrimary) {
      this.primaryDomainByTenant.add(input.tenantId);
    }
    return Promise.resolve();
  }

  upsertTenantSetting(input: UpsertTenantSettingInput): Promise<void> {
    this.settings.set(`${input.tenantId}:${input.key}`, input.valueJson);
    return Promise.resolve();
  }
}
