import type { DbTransactionPort } from "../../domain-services/db-transaction.port.js";

/**
 * No real transaction — just invokes `work` with `tx = undefined`, which
 * every in-memory repository test double ignores. Real transactional
 * behavior (atomicity, rollback-on-failure) is exercised against Postgres
 * in the integration suite, not here.
 */
export class FakeDbTransactionPort implements DbTransactionPort {
  run<T>(work: (tx: undefined) => Promise<T>): Promise<T> {
    return work(undefined);
  }
}
