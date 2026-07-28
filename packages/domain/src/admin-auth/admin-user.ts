import { Entity } from "../entity.js";

import { AdminRoleTenantMismatchError } from "./admin-auth-errors.js";
import type { AdminEmail } from "./admin-email.js";
import type { AdminName } from "./admin-name.js";
import { adminRoleRequiresTenant, type AdminRole } from "./admin-role.js";
import type { AdminStatus } from "./admin-status.js";
import type { Permission } from "./permission.js";
import { roleHasPermission } from "./role-permission-map.js";

function assertRoleTenantInvariant(role: AdminRole, tenantId: string | null): void {
  const requiresTenant = adminRoleRequiresTenant(role);
  if (requiresTenant && tenantId === null) {
    throw new AdminRoleTenantMismatchError(`Role ${role} requires a tenantId`);
  }
  if (!requiresTenant && tenantId !== null) {
    throw new AdminRoleTenantMismatchError(`Role ${role} (SUPER_ADMIN) must not have a tenantId`);
  }
}

export interface AdminUserProps {
  id: string;
  tenantId: string | null;
  email: AdminEmail;
  passwordHash: string;
  name: AdminName;
  role: AdminRole;
  status: AdminStatus;
  failedLoginCount: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  passwordChangedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAdminUserInput {
  id: string;
  tenantId: string | null;
  email: AdminEmail;
  passwordHash: string;
  name: AdminName;
  role: AdminRole;
  now: Date;
}

export class AdminUser extends Entity<string> {
  private props: AdminUserProps;

  private constructor(props: AdminUserProps) {
    super(props.id);
    this.props = props;
  }

  static create(input: CreateAdminUserInput): AdminUser {
    assertRoleTenantInvariant(input.role, input.tenantId);
    return new AdminUser({
      id: input.id,
      tenantId: input.tenantId,
      email: input.email,
      passwordHash: input.passwordHash,
      name: input.name,
      role: input.role,
      status: "ACTIVE",
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: null,
      passwordChangedAt: input.now,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  /** Rehydrates an AdminUser from persisted state — never validates business rules. */
  static reconstitute(props: AdminUserProps): AdminUser {
    return new AdminUser(props);
  }

  get tenantId(): string | null {
    return this.props.tenantId;
  }

  get email(): AdminEmail {
    return this.props.email;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get name(): AdminName {
    return this.props.name;
  }

  get role(): AdminRole {
    return this.props.role;
  }

  get status(): AdminStatus {
    return this.props.status;
  }

  get failedLoginCount(): number {
    return this.props.failedLoginCount;
  }

  get lockedUntil(): Date | null {
    return this.props.lockedUntil;
  }

  get lastLoginAt(): Date | null {
    return this.props.lastLoginAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isActive(): boolean {
    return this.props.status === "ACTIVE";
  }

  isLocked(now: Date): boolean {
    return this.props.lockedUntil !== null && this.props.lockedUntil.getTime() > now.getTime();
  }

  hasPermission(permission: Permission): boolean {
    return roleHasPermission(this.props.role, permission);
  }

  /**
   * Increments the consecutive-failure counter and, once it reaches
   * `maxFailures`, locks the account for `lockoutSeconds` (section 3.5).
   * The counter is reset to 0 by `recordSuccessfulLogin()`, so it tracks
   * *consecutive* failures rather than a rolling time-window count.
   */
  recordFailedLogin(now: Date, maxFailures: number, lockoutSeconds: number): void {
    this.props.failedLoginCount += 1;
    if (this.props.failedLoginCount >= maxFailures) {
      this.props.lockedUntil = new Date(now.getTime() + lockoutSeconds * 1000);
    }
    this.props.updatedAt = now;
  }

  recordSuccessfulLogin(now: Date): void {
    this.props.failedLoginCount = 0;
    this.props.lockedUntil = null;
    this.props.lastLoginAt = now;
    this.props.updatedAt = now;
  }
}
