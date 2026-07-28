import { Prisma } from "@ai-art-platform/database";
import {
  AdminAlreadyExistsError,
  AdminUser,
  type AdminEmail,
  type AdminUserRepository,
  type AtomicFailedLoginResult,
  type DbTransactionHandle,
} from "@ai-art-platform/domain";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../infrastructure/database/prisma.service.js";

import { toCreateInput, toDomainAdminUser, toUpdateInput } from "./admin-user.mapper.js";
import { clientFor } from "./prisma-tx.js";

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

interface AtomicFailedLoginRow {
  failed_login_count: number;
  locked_until: Date | null;
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

  async update(adminUser: AdminUser, tx?: DbTransactionHandle): Promise<void> {
    await clientFor(this.prisma.client, tx).adminUser.update({
      where: { id: adminUser.id },
      data: toUpdateInput(adminUser),
    });
  }

  /**
   * Single atomic UPDATE (P0-3) — reads and writes `failed_login_count` in
   * the same statement, so Postgres's row-level locking serializes
   * concurrent callers instead of letting a read-modify-write via
   * `update()` lose an increment. The `locked_until` branch is evaluated
   * against the *new* count within the same statement, so the lock is set
   * atomically with the count that triggered it.
   */
  async recordFailedLoginAtomically(
    id: string,
    params: { now: Date; maxFailures: number; lockoutSeconds: number },
    tx?: DbTransactionHandle,
  ): Promise<AtomicFailedLoginResult> {
    const lockedUntilIfTripped = new Date(params.now.getTime() + params.lockoutSeconds * 1000);
    const rows = await clientFor(this.prisma.client, tx).$queryRaw<AtomicFailedLoginRow[]>`
      UPDATE admin_users
      SET failed_login_count = failed_login_count + 1,
          locked_until = CASE
            WHEN failed_login_count + 1 >= ${params.maxFailures}
              THEN ${lockedUntilIfTripped}
            ELSE locked_until
          END,
          updated_at = ${params.now}
      WHERE id = ${id}::uuid
      RETURNING failed_login_count, locked_until
    `;
    const row = rows[0];
    if (!row) {
      throw new Error(`recordFailedLoginAtomically: admin ${id} not found`);
    }
    return { failedLoginCount: row.failed_login_count, lockedUntil: row.locked_until };
  }

  /** Atomic (trivially — no read-modify-write dependency) reset + lastLoginAt stamp. */
  async recordSuccessfulLoginAtomically(
    id: string,
    now: Date,
    tx?: DbTransactionHandle,
  ): Promise<void> {
    await clientFor(this.prisma.client, tx).adminUser.update({
      where: { id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now, updatedAt: now },
    });
  }
}
