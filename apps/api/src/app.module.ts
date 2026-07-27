import { Module } from "@nestjs/common";

import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { HealthModule } from "./health/health.module.js";
import { DatabaseModule } from "./infrastructure/database/database.module.js";
import { TenantModule } from "./modules/tenant/tenant.module.js";

@Module({
  imports: [DatabaseModule, HealthModule, TenantModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
