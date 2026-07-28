import type { Prisma } from "@ai-art-platform/database";
import {
  AdminEmail,
  AdminName,
  AdminUser,
  type AdminRole,
  type AdminStatus,
} from "@ai-art-platform/domain";

type PersistedAdminUser = {
  id: string;
  tenantId: string | null;
  email: string;
  passwordHash: string;
  name: string;
  role: AdminRole;
  status: AdminStatus;
  failedLoginCount: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  passwordChangedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

/** Prisma row -> Domain entity. Throws if a stored email/name somehow fails domain validation. */
export function toDomainAdminUser(row: PersistedAdminUser): AdminUser {
  const emailResult = AdminEmail.create(row.email);
  if (!emailResult.ok) {
    throw emailResult.error;
  }
  const nameResult = AdminName.create(row.name);
  if (!nameResult.ok) {
    throw nameResult.error;
  }
  return AdminUser.reconstitute({
    id: row.id,
    tenantId: row.tenantId,
    email: emailResult.value,
    passwordHash: row.passwordHash,
    name: nameResult.value,
    role: row.role,
    status: row.status,
    failedLoginCount: row.failedLoginCount,
    lockedUntil: row.lockedUntil,
    lastLoginAt: row.lastLoginAt,
    passwordChangedAt: row.passwordChangedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/** Domain entity -> Prisma create input. */
export function toCreateInput(
  admin: AdminUser,
  passwordChangedAt: Date,
): Prisma.AdminUserCreateInput {
  return {
    id: admin.id,
    tenant: admin.tenantId ? { connect: { id: admin.tenantId } } : undefined,
    email: admin.email.toString(),
    passwordHash: admin.passwordHash,
    name: admin.name.toString(),
    role: admin.role,
    status: admin.status,
    failedLoginCount: admin.failedLoginCount,
    lockedUntil: admin.lockedUntil,
    lastLoginAt: admin.lastLoginAt,
    passwordChangedAt,
    updatedAt: admin.updatedAt,
  };
}

/** Domain entity -> Prisma update input (id is used as the where clause, not the payload). */
export function toUpdateInput(admin: AdminUser): Prisma.AdminUserUpdateInput {
  return {
    status: admin.status,
    failedLoginCount: admin.failedLoginCount,
    lockedUntil: admin.lockedUntil,
    lastLoginAt: admin.lastLoginAt,
    updatedAt: admin.updatedAt,
  };
}
