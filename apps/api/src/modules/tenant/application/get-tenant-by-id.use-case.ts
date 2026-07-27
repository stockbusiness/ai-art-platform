import {
  TENANT_REPOSITORY,
  TenantNotFoundError,
  type Tenant,
  type TenantRepository,
} from "@ai-art-platform/domain";
import { Inject, Injectable } from "@nestjs/common";

@Injectable()
export class GetTenantByIdUseCase {
  constructor(@Inject(TENANT_REPOSITORY) private readonly tenantRepository: TenantRepository) {}

  async execute(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findById(id);
    if (!tenant) {
      throw new TenantNotFoundError(`Tenant "${id}" was not found`);
    }
    return tenant;
  }
}
