import {
  AdminAlreadyExistsError,
  type AdminEmail,
  type AdminUser,
  type AdminUserRepository,
  type AtomicFailedLoginResult,
} from "@ai-art-platform/domain";

/**
 * In-memory AdminUserRepository test double — no Prisma, no NestJS, no
 * real DB. Concurrency-safety of `recordFailedLoginAtomically` /
 * `recordSuccessfulLoginAtomically` is meaningless here (single-threaded
 * JS, no real races) — those are exercised for real against Postgres in
 * the integration suite; this double only needs to match the domain
 * entity's own state transitions.
 */
export class InMemoryAdminUserRepository implements AdminUserRepository {
  private byId = new Map<string, AdminUser>();

  findById(id: string): Promise<AdminUser | null> {
    return Promise.resolve(this.byId.get(id) ?? null);
  }

  findByTenantAndEmail(tenantId: string, email: AdminEmail): Promise<AdminUser | null> {
    for (const admin of this.byId.values()) {
      if (admin.tenantId === tenantId && admin.email.equals(email)) {
        return Promise.resolve(admin);
      }
    }
    return Promise.resolve(null);
  }

  findSuperAdminByEmail(email: AdminEmail): Promise<AdminUser | null> {
    for (const admin of this.byId.values()) {
      if (admin.tenantId === null && admin.role === "SUPER_ADMIN" && admin.email.equals(email)) {
        return Promise.resolve(admin);
      }
    }
    return Promise.resolve(null);
  }

  async create(admin: AdminUser): Promise<void> {
    const existing =
      admin.tenantId !== null
        ? await this.findByTenantAndEmail(admin.tenantId, admin.email)
        : await this.findSuperAdminByEmail(admin.email);
    if (existing) {
      throw new AdminAlreadyExistsError(`Admin "${admin.email.toString()}" already exists`);
    }
    this.byId.set(admin.id, admin);
  }

  update(admin: AdminUser): Promise<void> {
    this.byId.set(admin.id, admin);
    return Promise.resolve();
  }

  recordFailedLoginAtomically(
    id: string,
    params: { now: Date; maxFailures: number; lockoutSeconds: number },
  ): Promise<AtomicFailedLoginResult> {
    const admin = this.byId.get(id);
    if (!admin) {
      throw new Error(`recordFailedLoginAtomically: admin ${id} not found`);
    }
    admin.recordFailedLogin(params.now, params.maxFailures, params.lockoutSeconds);
    return Promise.resolve({
      failedLoginCount: admin.failedLoginCount,
      lockedUntil: admin.lockedUntil,
    });
  }

  recordSuccessfulLoginAtomically(id: string, now: Date): Promise<void> {
    const admin = this.byId.get(id);
    if (!admin) {
      throw new Error(`recordSuccessfulLoginAtomically: admin ${id} not found`);
    }
    admin.recordSuccessfulLogin(now);
    return Promise.resolve();
  }
}
