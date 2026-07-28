import type { AdminEmail } from "./admin-email.js";
import type { AdminUser } from "./admin-user.js";

/** DI token — see tenant-repository.ts for why a plain string, not a class/decorator. */
export const ADMIN_USER_REPOSITORY = "ADMIN_USER_REPOSITORY";

/**
 * Opaque handle to an in-flight DB transaction, threaded through
 * repository calls that must participate in the same transaction as their
 * caller. The Domain layer never inspects it — only the Prisma-backed
 * infrastructure adapter knows what's really inside (a
 * `Prisma.TransactionClient`) — so this stays `unknown` here rather than
 * importing a Prisma type, keeping the Domain layer Prisma-free.
 */
export type DbTransactionHandle = unknown;

export interface AtomicFailedLoginResult {
  failedLoginCount: number;
  lockedUntil: Date | null;
}

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
  update(adminUser: AdminUser, tx?: DbTransactionHandle): Promise<void>;
  /**
   * Atomically increments `failed_login_count` and, once it reaches
   * `maxFailures`, sets `locked_until` — as a single DB statement (an SQL
   * `UPDATE ... SET failed_login_count = failed_login_count + 1 ...
   * RETURNING`), so concurrent failed attempts against the same admin can
   * never lose an update (unlike a read-modify-write via `update()`).
   */
  recordFailedLoginAtomically(
    id: string,
    params: { now: Date; maxFailures: number; lockoutSeconds: number },
    tx?: DbTransactionHandle,
  ): Promise<AtomicFailedLoginResult>;
  /** Atomically resets the failure counter/lock and stamps lastLoginAt. */
  recordSuccessfulLoginAtomically(id: string, now: Date, tx?: DbTransactionHandle): Promise<void>;
}
