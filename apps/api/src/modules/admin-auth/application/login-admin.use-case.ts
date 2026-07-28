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
  type DbTransactionHandle,
  type TenantRepository,
} from "@ai-art-platform/domain";
import { Inject, Injectable } from "@nestjs/common";

import { API_ENV } from "../../../infrastructure/config/api-config.module.js";
import { AUTH_CLOCK, type AuthClock } from "../domain-services/auth-clock.port.js";
import {
  DB_TRANSACTION_PORT,
  type DbTransactionPort,
} from "../domain-services/db-transaction.port.js";
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
 * Discriminates an *expected* auth outcome (bad credentials, lockout, rate
 * limit) from the transaction's return value, so those cases can be
 * *returned* from the `unitOfWork.run()` callback instead of thrown —
 * throwing inside an interactive Prisma transaction rolls it back, which
 * would discard the very audit-log row / atomic counter update the
 * failure path just wrote (P1-1). Only a genuine unexpected error (DB
 * down, constraint violation, ...) should propagate as a real exception
 * and roll the transaction back.
 */
type LoginOutcome =
  | { kind: "success"; value: LoginAdminResult }
  | { kind: "failure"; error: AdminAuthenticationFailedError | AdminTooManyAttemptsError };

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
    @Inject(DB_TRANSACTION_PORT) private readonly unitOfWork: DbTransactionPort,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  async execute(input: LoginAdminInput): Promise<LoginAdminResult> {
    const outcome = await this.unitOfWork.run((tx) => this.runInTransaction(input, tx));
    if (outcome.kind === "failure") {
      throw outcome.error;
    }
    return outcome.value;
  }

  private async runInTransaction(
    input: LoginAdminInput,
    tx: DbTransactionHandle,
  ): Promise<LoginOutcome> {
    const now = this.clock.now();
    const ipHash = hashWithSecret(input.ip, this.env.AUTH_IP_HASH_SECRET);
    const userAgentHash = hashWithSecret(input.userAgent, this.env.AUTH_IP_HASH_SECRET);
    const emailHash = hashWithSecret(
      input.emailRaw.trim().toLowerCase(),
      this.env.AUTH_IP_HASH_SECRET,
    );

    // Serializes every attempt from this IP against every other concurrent
    // attempt from the same IP for the rest of this transaction (P0-4) —
    // must be acquired before the count check below.
    await this.loginEvents.acquireIpRateLimitLock(ipHash, tx);

    const recentIpFailures = await this.loginEvents.countRecentFailuresByIpHash(
      ipHash,
      now,
      this.env.ADMIN_LOGIN_WINDOW_SECONDS,
      tx,
    );
    if (recentIpFailures >= this.env.ADMIN_LOGIN_IP_MAX_FAILURES) {
      await this.recordFailure(tx, {
        adminUserId: null,
        tenantId: null,
        emailHash,
        ipHash,
        userAgentHash,
        requestId: input.requestId,
        now,
        reason: "IP_RATE_LIMITED",
      });
      return { kind: "failure", error: new AdminTooManyAttemptsError("Too many login attempts") };
    }

    const emailResult = AdminEmail.create(input.emailRaw);
    if (!emailResult.ok) {
      await this.passwordHasher.verifyDummy(input.password);
      await this.recordFailure(tx, {
        adminUserId: null,
        tenantId: null,
        emailHash,
        ipHash,
        userAgentHash,
        requestId: input.requestId,
        now,
        reason: "INVALID_CREDENTIALS",
      });
      return { kind: "failure", error: new AdminAuthenticationFailedError("Invalid credentials") };
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
        await this.passwordHasher.verifyDummy(input.password);
        await this.recordFailure(tx, {
          adminUserId: null,
          tenantId: tenant?.id ?? null,
          emailHash,
          ipHash,
          userAgentHash,
          requestId: input.requestId,
          now,
          reason: "TENANT_UNAVAILABLE",
        });
        return {
          kind: "failure",
          error: new AdminAuthenticationFailedError("Invalid credentials"),
        };
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
      await this.passwordHasher.verifyDummy(input.password);
      await this.recordFailure(tx, {
        adminUserId: null,
        tenantId,
        emailHash,
        ipHash,
        userAgentHash,
        requestId: input.requestId,
        now,
        reason: "INVALID_CREDENTIALS",
      });
      return { kind: "failure", error: new AdminAuthenticationFailedError("Invalid credentials") };
    }

    if (!admin.isActive()) {
      await this.passwordHasher.verifyDummy(input.password);
      await this.recordFailure(tx, {
        adminUserId: admin.id,
        tenantId,
        emailHash,
        ipHash,
        userAgentHash,
        requestId: input.requestId,
        now,
        reason: "ACCOUNT_DISABLED",
      });
      return { kind: "failure", error: new AdminAuthenticationFailedError("Invalid credentials") };
    }

    // Locked accounts are rejected before the password is even checked —
    // section 3.5: "Lock中は正しいPasswordでも拒否".
    if (admin.isLocked(now)) {
      await this.recordFailure(tx, {
        adminUserId: admin.id,
        tenantId,
        emailHash,
        ipHash,
        userAgentHash,
        requestId: input.requestId,
        now,
        reason: "ACCOUNT_LOCKED",
      });
      return {
        kind: "failure",
        error: new AdminTooManyAttemptsError("Account temporarily locked"),
      };
    }

    const passwordMatches = await this.passwordHasher.verify(admin.passwordHash, input.password);
    if (!passwordMatches) {
      // Atomic increment (P0-3) — never a read-modify-write via update().
      await this.adminUsers.recordFailedLoginAtomically(
        admin.id,
        {
          now,
          maxFailures: this.env.ADMIN_LOGIN_ACCOUNT_MAX_FAILURES,
          lockoutSeconds: this.env.ADMIN_LOCKOUT_SECONDS,
        },
        tx,
      );
      await this.recordFailure(tx, {
        adminUserId: admin.id,
        tenantId,
        emailHash,
        ipHash,
        userAgentHash,
        requestId: input.requestId,
        now,
        reason: "INVALID_CREDENTIALS",
      });
      return { kind: "failure", error: new AdminAuthenticationFailedError("Invalid credentials") };
    }

    await this.adminUsers.recordSuccessfulLoginAtomically(admin.id, now, tx);
    admin.recordSuccessfulLogin(now);

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
    await this.sessions.create(session, tx);

    await this.loginEvents.record(
      {
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
      },
      tx,
    );

    return {
      kind: "success",
      value: {
        admin,
        tenantKey,
        sessionToken: sessionToken.raw,
        csrfToken: csrfToken.raw,
      },
    };
  }

  private async recordFailure(
    tx: DbTransactionHandle,
    params: {
      adminUserId: string | null;
      tenantId: string | null;
      emailHash: string;
      ipHash: string;
      userAgentHash: string;
      requestId: string;
      now: Date;
      reason: AdminLoginFailureReason;
    },
  ): Promise<void> {
    await this.loginEvents.record(
      {
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
      },
      tx,
    );
  }
}
