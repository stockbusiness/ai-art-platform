import { PrismaClient } from "../generated/client/index.js";

export { Prisma, PrismaClient } from "../generated/client/index.js";

export interface CreatePrismaClientOptions {
  /**
   * Overrides the runtime connection string. Falls back to DATABASE_URL via
   * Prisma's own env() resolution in schema.prisma when omitted — pass this
   * explicitly for integration tests that target an isolated database.
   */
  databaseUrl?: string;
}

/**
 * Factory for a PrismaClient instance. Callers (apps/api's DatabaseModule,
 * integration tests) own the connect/disconnect lifecycle — this package
 * only knows how to construct a client, never when to use one.
 */
export function createPrismaClient(options: CreatePrismaClientOptions = {}): PrismaClient {
  return new PrismaClient(
    options.databaseUrl ? { datasources: { db: { url: options.databaseUrl } } } : undefined,
  );
}
