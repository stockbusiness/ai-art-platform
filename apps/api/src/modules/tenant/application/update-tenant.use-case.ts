import {
  TENANT_REPOSITORY,
  TenantNotFoundError,
  type Tenant,
  type TenantRepository,
  type TenantStatus,
} from "@ai-art-platform/domain";
import { Inject, Injectable } from "@nestjs/common";

export interface UpdateTenantCommand {
  id: string;
  name?: string;
  status?: TenantStatus;
}

/**
 * Internal use case only — no HTTP endpoint in PR-02 (section 7.3, 13.4).
 * Exercised directly by Unit/Integration tests.
 */
@Injectable()
export class UpdateTenantUseCase {
  constructor(@Inject(TENANT_REPOSITORY) private readonly tenantRepository: TenantRepository) {}

  async execute(command: UpdateTenantCommand): Promise<Tenant> {
    const tenant = await this.tenantRepository.findById(command.id);
    if (!tenant) {
      throw new TenantNotFoundError(`Tenant "${command.id}" was not found`);
    }

    const now = new Date();
    if (command.name !== undefined) {
      tenant.rename(command.name, now);
    }
    if (command.status !== undefined) {
      tenant.changeStatus(command.status, now);
    }

    await this.tenantRepository.update(tenant);
    return tenant;
  }
}
