import { randomUUID } from "node:crypto";

import type { ApiEnv } from "@ai-art-platform/config";
import {
  ADMIN_LOGIN_EVENT_REPOSITORY,
  ADMIN_SESSION_REPOSITORY,
  ADMIN_USER_REPOSITORY,
  AdminAuthenticationFailedError,
  AdminEmail,
  AdminSession,
  AdminTooManyAttemptsError,
  TENANT_REPOSITORY,
  TenantKey,
  type AdminLoginEventRepository,
  type AdminLoginFailureReason,
  type AdminSessionRepository,
  type AdminUser,
  type AdminUserRepository,
  type TenantRepository,
} from "@ai-art-platform/domain";
import { Inject, Injectable } from "@nestjs/common";

import { API_ENV } from "../../../infrastructure/config/api-config.module.js";
import { AUTH_CLOCK, type AuthClock } from "../domain-services/auth-clock.port.js";
import { PASSWORD_HASHER, type PasswordHasher } from "../domain-services/password-hasher.port.js";
import {
  SESSION_TOKEN_PORT,
  type SessionTokenPort,
} from "../domain-services/session-token.port.js";
import { hashWithSecret } from "../infrastructure/request-fingerprint.js";

export interface LoginAdminInput {
  /** Absent ⇒ SUPER_ADMIN login (section 3.2). */
  tenantKeyRaw: string | null;
  emailRaw: string;
  password: string;
  ip: string;
  userAgent: string;
  requestId: string;
}

export interface LoginAdminResult {
  admin: AdminUser;
  tenantKey: string | null;
  /** Raw (unhashed) token — set on the Session Cookie, never persisted as-is. */
  sessionToken: string;
  /** Raw (unhashed) token — set on the CSRF Cookie, never persisted as-is. */
  csrfToken: string;
}

/**
 * Backs POST /api/v1/admin/auth/login. Every failure path throws either
 * AdminAuthenticationFailedError (401) or AdminTooManyAttemptsError (429)
 * — the specific reason (unknown tenant, unknown email, wrong password,
 * disabled account, ...) is recorded server-side only, in
 * admin_login_events, never in the thrown error's message or the HTTP
 * response (section 3.2/3.5).
 */
@Injectable()
export class LoginAdminUseCase {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY) private readonly adminUsers: AdminUserRepository,
    @Inject(ADMIN_SESSION_REPOSITORY) private readonly sessions: AdminSessionRepository,
    @Inject(ADMIN_LOGIN_EVENT_REPOSITORY) private readonly loginEvents: AdminLoginEventRepository,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(SESSION_TOKEN_PORT) private readonly sessionTokens: SessionTokenPort,
    @Inject(AUTH_CLOCK) private readonly clock: AuthClock,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  async execute(input: LoginAdminInput): Promise<LoginAdminResult> {
    const now = this.clock.now();
    const ipHash = hashWithSecret(input.ip, this.env.AUTH_IP_HASH_SECRET);
    const userAgentHash = hashWithSecret(input.userAgent, this.env.AUTH_IP_HASH_SECRET);
    const emailHash = hashWithSecret(
      input.emailRaw.trim().toLowerCase(),
      this.env.AUTH_IP_HASH_SECRET,
    );

    const recentIpFailures = await this.loginEvents.countRecentFailuresByIpHash(
      ipHash,
      now,
      this.env.ADMIN_LOGIN_WINDOW_SECONDS,
    );
    if (recentIpFailures >= this.env.ADMIN_LOGIN_IP_MAX_FAILURES) {
      await this.recordFailure({
        adminUserId: null,
        tenantId: null,
        emailHash,
        ipHash,
        userAgentHash,
        requestId: input.requestId,
        now,
        reason: "IP_RATE_LIMITED",
      });
      throw new AdminTooManyAttemptsError("Too many login attempts");
    }

    const emailResult = AdminEmail.create(input.emailRaw);
    if (!emailResult.ok) {
      await this.recordFailure({
        adminUserId: null,
        tenantId: null,
        emailHash,
        ipHash,
        userAgentHash,
        requestId: input.requestId,
        now,
        reason: "INVALID_CREDENTIALS",
      });
      throw new AdminAuthenticationFailedError("Invalid credentials");
    }
    const email = emailResult.value;

    let tenantId: string | null = null;
    let tenantKey: string | null = null;
    if (input.tenantKeyRaw !== null) {
      const tenantKeyResult = TenantKey.create(input.tenantKeyRaw);
      const tenant = tenantKeyResult.ok
        ? await this.tenants.findByTenantKey(tenantKeyResult.value)
        : null;
      if (!tenant || !tenant.isActive()) {
        await this.recordFailure({
          adminUserId: null,
          tenantId: tenant?.id ?? null,
          emailHash,
          ipHash,
          userAgentHash,
          requestId: input.requestId,
          now,
          reason: "TENANT_UNAVAILABLE",
        });
        throw new AdminAuthenticationFailedError("Invalid credentials");
      }
      tenantId = tenant.id;
      tenantKey = tenant.tenantKey.toString();
    }

    // Tenant-scoped lookup only ever searches within `tenantId`; SUPER_ADMIN
    // lookup only ever searches tenantId IS NULL rows — neither ever falls
    // back to the other (section 3.2).
    const admin =
      tenantId !== null
        ? await this.adminUsers.findByTenantAndEmail(tenantId, email)
        : await this.adminUsers.findSuperAdminByEmail(email);

    if (!admin) {
      await this.recordFailure({
        adminUserId: null,
        tenantId,
        emailHash,
        ipHash,
        userAgentHash,
        requestId: input.requestId,
        now,
        reason: "INVALID_CREDENTIALS",
      });
      throw new AdminAuthenticationFailedError("Invalid credentials");
    }

    if (!admin.isActive()) {
      await this.recordFailure({
        adminUserId: admin.id,
        tenantId,
        emailHash,
        ipHash,
        userAgentHash,
        requestId: input.requestId,
        now,
        reason: "ACCOUNT_DISABLED",
      });
      throw new AdminAuthenticationFailedError("Invalid credentials");
    }

    // Locked accounts are rejected before the password is even checked —
    // section 3.5: "Lock中は正しいPasswordでも拒否".
    if (admin.isLocked(now)) {
      await this.recordFailure({
        adminUserId: admin.id,
        tenantId,
        emailHash,
        ipHash,
        userAgentHash,
        requestId: input.requestId,
        now,
        reason: "ACCOUNT_LOCKED",
      });
      throw new AdminTooManyAttemptsError("Account temporarily locked");
    }

    const passwordMatches = await this.passwordHasher.verify(admin.passwordHash, input.password);
    if (!passwordMatches) {
      admin.recordFailedLogin(
        now,
        this.env.ADMIN_LOGIN_ACCOUNT_MAX_FAILURES,
        this.env.ADMIN_LOCKOUT_SECONDS,
      );
      await this.adminUsers.update(admin);
      await this.recordFailure({
        adminUserId: admin.id,
        tenantId,
        emailHash,
        ipHash,
        userAgentHash,
        requestId: input.requestId,
        now,
        reason: "INVALID_CREDENTIALS",
      });
      throw new AdminAuthenticationFailedError("Invalid credentials");
    }

    admin.recordSuccessfulLogin(now);
    await this.adminUsers.update(admin);

    const sessionToken = this.sessionTokens.generateSessionToken();
    const csrfToken = this.sessionTokens.generateCsrfToken();
    const session = AdminSession.create({
      id: randomUUID(),
      adminUserId: admin.id,
      tokenHash: sessionToken.hash,
      csrfTokenHash: csrfToken.hash,
      ipHash,
      userAgentHash,
      now,
      ttlSeconds: this.env.ADMIN_SESSION_TTL_SECONDS,
    });
    await this.sessions.create(session);

    await this.loginEvents.record({
      id: randomUUID(),
      adminUserId: admin.id,
      tenantId,
      emailHash,
      success: true,
      failureReason: null,
      ipHash,
      userAgentHash,
      requestId: input.requestId,
      now,
    });

    return {
      admin,
      tenantKey,
      sessionToken: sessionToken.raw,
      csrfToken: csrfToken.raw,
    };
  }

  private async recordFailure(params: {
    adminUserId: string | null;
    tenantId: string | null;
    emailHash: string;
    ipHash: string;
    userAgentHash: string;
    requestId: string;
    now: Date;
    reason: AdminLoginFailureReason;
  }): Promise<void> {
    await this.loginEvents.record({
      id: randomUUID(),
      adminUserId: params.adminUserId,
      tenantId: params.tenantId,
      emailHash: params.emailHash,
      success: false,
      failureReason: params.reason,
      ipHash: params.ipHash,
      userAgentHash: params.userAgentHash,
      requestId: params.requestId,
      now: params.now,
    });
  }
}
