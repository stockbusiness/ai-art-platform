import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";

import { PrismaService } from "../infrastructure/database/prisma.service.js";

export interface ReadyResponse {
  status: "ready";
}

interface MigrationRow {
  finished_at: Date | null;
  rolled_back_at: Date | null;
}

/**
 * GET /ready confirms: PostgreSQL is reachable, Prisma Client can query,
 * `_prisma_migrations` exists, and every recorded migration finished
 * without being rolled back (section 13.3). Never includes the connection
 * string, host, SQL, or a stack trace in the response — only a generic
 * 503 on any failure.
 */
@Controller("ready")
export class ReadyController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<ReadyResponse> {
    try {
      const rows = await this.prisma.client.$queryRaw<MigrationRow[]>`
        SELECT finished_at, rolled_back_at FROM "_prisma_migrations"
      `;
      const hasIncompleteMigration = rows.some(
        (row) => row.finished_at === null || row.rolled_back_at !== null,
      );
      if (hasIncompleteMigration) {
        throw new ServiceUnavailableException("Database not ready");
      }
      return { status: "ready" };
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException("Database not ready");
    }
  }
}
