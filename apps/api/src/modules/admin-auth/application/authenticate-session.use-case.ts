import {
  ADMIN_SESSION_REPOSITORY,
  ADMIN_USER_REPOSITORY,
  AdminForbiddenError,
  AdminUnauthenticatedError,
  ROLE_PERMISSIONS,
  TENANT_REPOSITORY,
  adminRoleRequiresTenant,
  type AdminSessionRepository,
  type AdminUserRepository,
  type TenantRepository,
} from "@ai-art-platform/domain";
import { Inject, Injectable } from "@nestjs/common";

import { AUTH_CLOCK, type AuthClock } from "../domain-services/auth-clock.port.js";
import {
  SESSION_TOKEN_PORT,
  type SessionTokenPort,
} from "../domain-services/session-token.port.js";

import type { AuthenticatedAdminContext } from "./authenticated-admin-context.js";

/** Section 3.4: "最終アクセス更新: 最大5分に1回". Not env-configurable (section 10 lists no such variable). */
const MIN_TOUCH_INTERVAL_SECONDS = 5 * 60;

/**
 * Backs AdminAuthGuard. Resolves a raw Session Cookie value into a trusted
 * AuthenticatedAdminContext, or throws AdminUnauthenticatedError (401) /
 * AdminForbiddenError (403) — see section 8's rejection table.
 */
@Injectable()
export class AuthenticateSessionUseCase {
  constructor(
    @Inject(ADMIN_SESSION_REPOSITORY) private readonly sessions: AdminSessionRepository,
    @Inject(ADMIN_USER_REPOSITORY) private readonly adminUsers: AdminUserRepository,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
    @Inject(SESSION_TOKEN_PORT) private readonly sessionTokens: SessionTokenPort,
    @Inject(AUTH_CLOCK) private readonly clock: AuthClock,
  ) {}

  async execute(rawSessionToken: string): Promise<AuthenticatedAdminContext> {
    const now = this.clock.now();
    const tokenHash = this.sessionTokens.hash(rawSessionToken);
    const session = await this.sessions.findByTokenHash(tokenHash);
    if (!session || !session.isValid(now)) {
      throw new AdminUnauthenticatedError("Session is invalid");
    }

    const admin = await this.adminUsers.findById(session.adminUserId);
    if (!admin || !admin.isActive()) {
      throw new AdminUnauthenticatedError("Session is invalid");
    }

    // Defensive re-check of the invariant AdminUser.create() and the DB
    // CHECK constraint already enforce — should be unreachable in
    // practice, but a Guard must never trust a role/tenantId combination
    // it has not itself validated.
    if (adminRoleRequiresTenant(admin.role) !== (admin.tenantId !== null)) {
      throw new AdminForbiddenError("Inconsistent admin role/tenant state");
    }

    let tenantKey: string | null = null;
    if (admin.tenantId !== null) {
      const tenant = await this.tenants.findById(admin.tenantId);
      if (!tenant) {
        throw new AdminUnauthenticatedError("Session is invalid");
      }
      if (!tenant.isActive()) {
        throw new AdminForbiddenError("Tenant is suspended");
      }
      tenantKey = tenant.tenantKey.toString();
    }

    if (session.shouldTouch(now, MIN_TOUCH_INTERVAL_SECONDS)) {
      session.touch(now);
      await this.sessions.update(session);
    }

    return {
      sessionId: session.id,
      csrfTokenHash: session.csrfTokenHash,
      adminId: admin.id,
      tenantId: admin.tenantId,
      tenantKey,
      email: admin.email.toString(),
      name: admin.name.toString(),
      role: admin.role,
      permissions: ROLE_PERMISSIONS[admin.role],
    };
  }
}
