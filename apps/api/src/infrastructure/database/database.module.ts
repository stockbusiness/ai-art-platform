import { Global, Module } from "@nestjs/common";

import { PrismaService } from "./prisma.service.js";

/**
 * Global so every feature module (health, tenant, and later PRs) can
 * inject PrismaService without each one re-declaring it as a provider.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
