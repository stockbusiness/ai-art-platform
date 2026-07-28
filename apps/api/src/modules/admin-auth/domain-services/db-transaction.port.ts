import type { DbTransactionHandle } from "@ai-art-platform/domain";

export const DB_TRANSACTION_PORT = "DB_TRANSACTION_PORT";

/**
 * Port for running a unit of work inside a single DB transaction (P1-1).
 * `work` receives an opaque `DbTransactionHandle` that must be threaded
 * into every repository call that needs to participate in the same
 * transaction — the Application layer never inspects the handle itself,
 * only the Prisma-backed implementation knows it's really a
 * `Prisma.TransactionClient`.
 */
export interface DbTransactionPort {
  run<T>(work: (tx: DbTransactionHandle) => Promise<T>): Promise<T>;
}
