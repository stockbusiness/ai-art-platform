import type { AdminEmail } from "./admin-email.js";
import type { AdminUser } from "./admin-user.js";

/** DI token — see tenant-repository.ts for why a plain string, not a class/decorator. */
export const ADMIN_USER_REPOSITORY = "ADMIN_USER_REPOSITORY";

/**
 * Port for AdminUser persistence. Implemented in
 * apps/api/src/modules/admin-auth/infrastructure by a Prisma-backed
 * adapter — this interface must stay free of Prisma/HTTP types.
 */
export interface AdminUserRepository {
  findById(id: string): Promise<AdminUser | null>;
  /** Tenant-scoped admin lookup — used when a login request includes `tenantKey`. */
  findByTenantAndEmail(tenantId: string, email: AdminEmail): Promise<AdminUser | null>;
  /** SUPER_ADMIN lookup (tenantId IS NULL) — used when `tenantKey` is absent. */
  findSuperAdminByEmail(email: AdminEmail): Promise<AdminUser | null>;
  create(adminUser: AdminUser): Promise<void>;
  /** Persists mutable state changes (lockout counters, lastLoginAt, ...). */
  update(adminUser: AdminUser): Promise<void>;
}
