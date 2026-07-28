import type { Prisma, PrismaClient } from "@ai-art-platform/database";
import type { DbTransactionHandle } from "@ai-art-platform/domain";

/**
 * Resolves the Prisma client to issue a query against: the transaction
 * client when a `DbTransactionHandle` from `DbTransactionPort.run()` was
 * passed through, otherwise the app-wide singleton. Every repository that
 * accepts an optional `tx` parameter routes through this so the same
 * casting logic — and its safety comment — lives in exactly one place.
 */
export function clientFor(
  defaultClient: PrismaClient,
  tx: DbTransactionHandle,
): PrismaClient | Prisma.TransactionClient {
  // `tx` only ever originates from PrismaDbTransactionService.run(), which
  // hands the Application layer exactly what `$transaction()` gave it —
  // this cast is safe because the Domain-layer `DbTransactionHandle` type
  // exists solely to let that value pass through Application code opaquely.
  return (tx as Prisma.TransactionClient | undefined) ?? defaultClient;
}
