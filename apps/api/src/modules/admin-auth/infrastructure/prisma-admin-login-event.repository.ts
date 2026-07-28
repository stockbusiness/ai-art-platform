import type {
  AdminLoginEventRepository,
  RecordAdminLoginEventInput,
} from "@ai-art-platform/domain";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../infrastructure/database/prisma.service.js";

@Injectable()
export class PrismaAdminLoginEventRepository implements AdminLoginEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAdminLoginEventInput): Promise<void> {
    await this.prisma.client.adminLoginEvent.create({
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
  ): Promise<number> {
    const since = new Date(now.getTime() - windowSeconds * 1000);
    return this.prisma.client.adminLoginEvent.count({
      where: {
        ipHash,
        success: false,
        createdAt: { gte: since },
      },
    });
  }
}
