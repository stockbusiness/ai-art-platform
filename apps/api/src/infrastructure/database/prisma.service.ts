import { createPrismaClient, type PrismaClient } from "@ai-art-platform/database";
import { Injectable, type OnModuleDestroy } from "@nestjs/common";

/**
 * Owns the PrismaClient lifecycle for the whole app. Deliberately does
 * *not* eagerly connect on module init: Prisma connects lazily on the
 * first query, so the app boots (and `GET /health` responds) even when
 * the database is unreachable. Only `GET /ready` (and any other route
 * that actually queries) fails while the database is down — see
 * ReadyController.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient = createPrismaClient();

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
