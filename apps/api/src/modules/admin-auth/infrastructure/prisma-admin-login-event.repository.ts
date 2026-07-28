import type {
  AdminLoginEventRepository,
  DbTransactionHandle,
  RecordAdminLoginEventInput,
} from "@ai-art-platform/domain";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../infrastructure/database/prisma.service.js";

import { clientFor } from "./prisma-tx.js";

@Injectable()
export class PrismaAdminLoginEventRepository implements AdminLoginEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAdminLoginEventInput, tx?: DbTransactionHandle): Promise<void> {
    await clientFor(this.prisma.client, tx).adminLoginEvent.create({
      data: {
        id: input.id,
        adminUser: input.adminUserId ? { connect: { id: input.adminUserId } } : undefined,
        tenant: input.tenantId ? { connect: { id: input.tenantId } } : undefined,
        emailHash: input.emailHash,
        success: input.success,
        failureReason: input.failureReason ?? undefined,
        ipHash: input.ipHash,
        userAgentHash: input.userAgentHash,
        requestId: input.requestId,
        createdAt: input.now,
      },
    });
  }

  async countRecentFailuresByIpHash(
    ipHash: string,
    now: Date,
    windowSeconds: number,
    tx?: DbTransactionHandle,
  ): Promise<number> {
    const since = new Date(now.getTime() - windowSeconds * 1000);
    return clientFor(this.prisma.client, tx).adminLoginEvent.count({
      where: {
        ipHash,
        success: false,
        createdAt: { gte: since },
      },
    });
  }

  /**
   * `pg_advisory_xact_lock` keyed on the first 16 hex chars (64 bits) of
   * `ipHash`, released automatically at the enclosing transaction's
   * commit/rollback (P0-4). A different `ipHash` almost never derives the
   * same 64-bit key, so this never serializes unrelated IPs against each
   * other; an occasional hash collision only causes harmless extra
   * waiting, never incorrect rate-limit behavior.
   */
  async acquireIpRateLimitLock(ipHash: string, tx: DbTransactionHandle): Promise<void> {
    await clientFor(this.prisma.client, tx).$executeRaw`
      SELECT pg_advisory_xact_lock(('x' || substr(${ipHash}, 1, 16))::bit(64)::bigint)
    `;
  }
}
