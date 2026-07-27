import { randomUUID } from "node:crypto";

import {
  Tenant,
  TENANT_REPOSITORY,
  TenantKey,
  type TenantRepository,
} from "@ai-art-platform/domain";
import { Inject, Injectable } from "@nestjs/common";

export interface CreateTenantCommand {
  tenantKeyRaw: string;
  name: string;
  timezone?: string;
  defaultLocale?: string;
}

/**
 * Internal use case only — PR-02 exposes no HTTP endpoint for it (section
 * 13.4: no unauthenticated Tenant management API before PR-03's Admin
 * auth/RBAC). Exercised directly by Unit/Integration tests.
 */
@Injectable()
export class CreateTenantUseCase {
  constructor(@Inject(TENANT_REPOSITORY) private readonly tenantRepository: TenantRepository) {}

  async execute(command: CreateTenantCommand): Promise<Tenant> {
    const tenantKeyResult = TenantKey.create(command.tenantKeyRaw);
    if (!tenantKeyResult.ok) {
      throw tenantKeyResult.error;
    }

    const tenant = Tenant.create({
      id: randomUUID(),
      tenantKey: tenantKeyResult.value,
      name: command.name,
      timezone: command.timezone,
      defaultLocale: command.defaultLocale,
      now: new Date(),
    });

    await this.tenantRepository.create(tenant);
    return tenant;
  }
}
