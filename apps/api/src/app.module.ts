import { Module } from "@nestjs/common";

import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { HealthModule } from "./health/health.module.js";
import { ApiConfigModule } from "./infrastructure/config/api-config.module.js";
import { DatabaseModule } from "./infrastructure/database/database.module.js";
import { AdminAuthModule } from "./modules/admin-auth/admin-auth.module.js";
import { TenantModule } from "./modules/tenant/tenant.module.js";

@Module({
  imports: [ApiConfigModule, DatabaseModule, HealthModule, TenantModule, AdminAuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
