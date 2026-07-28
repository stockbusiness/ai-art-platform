import { AdminSession, type AdminSessionRepository } from "@ai-art-platform/domain";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../infrastructure/database/prisma.service.js";

import { toCreateInput, toDomainAdminSession, toUpdateInput } from "./admin-session.mapper.js";

@Injectable()
export class PrismaAdminSessionRepository implements AdminSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTokenHash(tokenHash: string): Promise<AdminSession | null> {
    const row = await this.prisma.client.adminSession.findUnique({ where: { tokenHash } });
    return row ? toDomainAdminSession(row) : null;
  }

  async create(session: AdminSession): Promise<void> {
    await this.prisma.client.adminSession.create({
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
