import {
  AdminSession,
  type AdminSessionRepository,
  type DbTransactionHandle,
} from "@ai-art-platform/domain";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../infrastructure/database/prisma.service.js";

import { toCreateInput, toDomainAdminSession, toUpdateInput } from "./admin-session.mapper.js";
import { clientFor } from "./prisma-tx.js";

@Injectable()
export class PrismaAdminSessionRepository implements AdminSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTokenHash(tokenHash: string): Promise<AdminSession | null> {
    const row = await this.prisma.client.adminSession.findUnique({ where: { tokenHash } });
    return row ? toDomainAdminSession(row) : null;
  }

  async create(session: AdminSession, tx?: DbTransactionHandle): Promise<void> {
    await clientFor(this.prisma.client, tx).adminSession.create({
      data: toCreateInput(session, session.ipHash, session.userAgentHash),
    });
  }

  async update(session: AdminSession): Promise<void> {
    await this.prisma.client.adminSession.update({
      where: { id: session.id },
      data: toUpdateInput(session),
    });
  }
}
