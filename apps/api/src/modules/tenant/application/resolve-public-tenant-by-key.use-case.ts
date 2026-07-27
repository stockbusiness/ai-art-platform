import {
  TENANT_REPOSITORY,
  TenantKey,
  TenantNotFoundError,
  TenantSuspendedError,
  type Tenant,
  type TenantRepository,
} from "@ai-art-platform/domain";
import { Inject, Injectable } from "@nestjs/common";

/**
 * Backs the only endpoint PR-02 exposes publicly:
 * GET /api/v1/public/tenants/:tenantKey (section 13.1). A raw tenantKey
 * from a client is never treated as an authenticated Tenant context —
 * it is validated, looked up, and must resolve to an ACTIVE tenant.
 */
@Injectable()
export class ResolvePublicTenantByKeyUseCase {
  constructor(@Inject(TENANT_REPOSITORY) private readonly tenantRepository: TenantRepository) {}

  async execute(tenantKeyRaw: string): Promise<Tenant> {
    const tenantKeyResult = TenantKey.create(tenantKeyRaw);
    if (!tenantKeyResult.ok) {
      throw tenantKeyResult.error;
    }

    const tenant = await this.tenantRepository.findByTenantKey(tenantKeyResult.value);
    if (!tenant) {
      throw new TenantNotFoundError(`Tenant "${tenantKeyRaw}" was not found`);
    }
    if (!tenant.isActive()) {
      throw new TenantSuspendedError(`Tenant "${tenantKeyRaw}" is suspended`);
    }
    return tenant;
  }
}
