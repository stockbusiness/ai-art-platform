import { Prisma } from "@ai-art-platform/database";
import {
  AdminAlreadyExistsError,
  AdminUser,
  type AdminEmail,
  type AdminUserRepository,
} from "@ai-art-platform/domain";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../infrastructure/database/prisma.service.js";

import { toCreateInput, toDomainAdminUser, toUpdateInput } from "./admin-user.mapper.js";

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

@Injectable()
export class PrismaAdminUserRepository implements AdminUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<AdminUser | null> {
    const row = await this.prisma.client.adminUser.findUnique({ where: { id } });
    return row ? toDomainAdminUser(row) : null;
  }

  async findByTenantAndEmail(tenantId: string, email: AdminEmail): Promise<AdminUser | null> {
    const row = await this.prisma.client.adminUser.findFirst({
      where: { tenantId, email: email.toString() },
    });
    return row ? toDomainAdminUser(row) : null;
  }

  async findSuperAdminByEmail(email: AdminEmail): Promise<AdminUser | null> {
    const row = await this.prisma.client.adminUser.findFirst({
      where: { tenantId: null, email: email.toString(), role: "SUPER_ADMIN" },
    });
    return row ? toDomainAdminUser(row) : null;
  }

  async create(adminUser: AdminUser): Promise<void> {
    try {
      await this.prisma.client.adminUser.create({
        data: toCreateInput(adminUser, new Date()),
      });
    } catch (error: unknown) {
      if (isUniqueConstraintViolation(error)) {
        throw new AdminAlreadyExistsError(
          `An admin with email "${adminUser.email.toString()}" already exists${
            adminUser.tenantId ? ` for tenant ${adminUser.tenantId}` : " as a SUPER_ADMIN"
          }`,
        );
      }
      throw error;
    }
  }

  async update(adminUser: AdminUser): Promise<void> {
    await this.prisma.client.adminUser.update({
      where: { id: adminUser.id },
      data: toUpdateInput(adminUser),
    });
  }
}
