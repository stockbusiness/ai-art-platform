import type { DbTransactionHandle } from "@ai-art-platform/domain";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../infrastructure/database/prisma.service.js";
import type { DbTransactionPort } from "../domain-services/db-transaction.port.js";

/**
 * A Login attempt's transaction can spend real wall-clock time waiting on
 * `acquireIpRateLimitLock` (P0-4) behind other concurrent attempts from
 * the same IP — each of those, in turn, may include a real or dummy
 * Argon2 verify (tens to hundreds of ms). Prisma's interactive-transaction
 * defaults (`maxWait` 2000ms to obtain a connection, `timeout` 5000ms to
 * finish once started) are tuned for short, uncontended transactions and
 * are too tight for a burst of many concurrent attempts against the same
 * IP — hitting them turns a legitimate (if unusually large) burst into a
 * spurious `AUTH_SERVICE_UNAVAILABLE` instead of the correct 401/429
 * sequence. Both are widened generously; this only affects how long a
 * request may wait/run, never correctness.
 */
const TRANSACTION_MAX_WAIT_MS = 10_000;
const TRANSACTION_TIMEOUT_MS = 15_000;

@Injectable()
export class PrismaDbTransactionService implements DbTransactionPort {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(work: (tx: DbTransactionHandle) => Promise<T>): Promise<T> {
    return this.prisma.client.$transaction((tx) => work(tx), {
      maxWait: TRANSACTION_MAX_WAIT_MS,
      timeout: TRANSACTION_TIMEOUT_MS,
    });
  }
}
