import {
  AdminAlreadyExistsError,
  type AdminEmail,
  type AdminUser,
  type AdminUserRepository,
} from "@ai-art-platform/domain";

/** In-memory AdminUserRepository test double — no Prisma, no NestJS, no real DB. */
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
}
