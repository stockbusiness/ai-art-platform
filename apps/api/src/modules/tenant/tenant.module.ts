import { TENANT_REPOSITORY } from "@ai-art-platform/domain";
import { Module } from "@nestjs/common";

import { CreateTenantUseCase } from "./application/create-tenant.use-case.js";
import { GetTenantByIdUseCase } from "./application/get-tenant-by-id.use-case.js";
import { ResolvePublicTenantByKeyUseCase } from "./application/resolve-public-tenant-by-key.use-case.js";
import { UpdateTenantUseCase } from "./application/update-tenant.use-case.js";
import { PrismaTenantRepository } from "./infrastructure/prisma-tenant.repository.js";
import { PublicTenantController } from "./presentation/public-tenant.controller.js";

@Module({
  controllers: [PublicTenantController],
  providers: [
    { provide: TENANT_REPOSITORY, useClass: PrismaTenantRepository },
    CreateTenantUseCase,
    GetTenantByIdUseCase,
    ResolvePublicTenantByKeyUseCase,
    UpdateTenantUseCase,
  ],
  exports: [CreateTenantUseCase, GetTenantByIdUseCase, UpdateTenantUseCase, TENANT_REPOSITORY],
})
export class TenantModule {}
