import { createPrismaClient, type PrismaClient } from "@ai-art-platform/database";
import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";

/**
 * Owns the PrismaClient connect/disconnect lifecycle for the whole app.
 * packages/database only knows how to construct a client — this is the
 * one place that decides when to connect and disconnect it.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client: PrismaClient = createPrismaClient();

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
