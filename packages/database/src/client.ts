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
 * Prisma's own default (`num_physical_cpus * 2 + 1`) is sized for typical
 * short, uncontended queries. PR-03A's admin-auth review-fix round
 * (P0-4) added a per-request-per-IP `pg_advisory_xact_lock` that holds a
 * connection for the duration of the whole login-attempt transaction —
 * under a burst of concurrent attempts from the same IP, that can queue
 * enough transactions to exhaust a CPU-derived default on a
 * resource-constrained CI runner. Raised generously; Postgres's own
 * default `max_connections` (100) comfortably accommodates it, and a
 * higher ceiling never hurts a lightly-loaded deployment.
 */
const DEFAULT_CONNECTION_LIMIT = 20;

function withConnectionLimit(url: string): string {
  if (/[?&]connection_limit=/.test(url)) {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}connection_limit=${DEFAULT_CONNECTION_LIMIT}`;
}

/**
 * Factory for a PrismaClient instance. Callers (apps/api's DatabaseModule,
 * integration tests) own the connect/disconnect lifecycle — this package
 * only knows how to construct a client, never when to use one.
 */
export function createPrismaClient(options: CreatePrismaClientOptions = {}): PrismaClient {
  const url = options.databaseUrl ?? process.env["DATABASE_URL"];
  if (!url) {
    // No URL resolvable here — fall back to Prisma's own env("DATABASE_URL")
    // resolution in schema.prisma (e.g. schema-validation-only contexts).
    return new PrismaClient();
  }
  return new PrismaClient({ datasources: { db: { url: withConnectionLimit(url) } } });
}
