import { ADMIN_SESSION_REPOSITORY, type AdminSessionRepository } from "@ai-art-platform/domain";
import { Inject, Injectable } from "@nestjs/common";

import { AUTH_CLOCK, type AuthClock } from "../domain-services/auth-clock.port.js";
import {
  SESSION_TOKEN_PORT,
  type SessionTokenPort,
} from "../domain-services/session-token.port.js";

/**
 * Backs POST /api/v1/admin/auth/logout. Idempotent — a raw token that no
 * longer resolves to a session (already revoked, or never existed) is
 * treated as "already logged out" rather than an error (section 7.3:
 * "同一Logout再送は安全に処理する"). Note that a *second* logout attempt
 * using the same Cookie will not reach this far — AdminAuthGuard rejects
 * an already-revoked session with 401 before the Controller runs; this
 * use case's idempotency covers the "token never resolved" case.
 */
@Injectable()
export class LogoutAdminUseCase {
  constructor(
    @Inject(ADMIN_SESSION_REPOSITORY) private readonly sessions: AdminSessionRepository,
    @Inject(SESSION_TOKEN_PORT) private readonly sessionTokens: SessionTokenPort,
    @Inject(AUTH_CLOCK) private readonly clock: AuthClock,
  ) {}

  async execute(rawSessionToken: string): Promise<void> {
    const now = this.clock.now();
    const tokenHash = this.sessionTokens.hash(rawSessionToken);
    const session = await this.sessions.findByTokenHash(tokenHash);
    if (!session) {
      return;
    }
    session.revoke(now, "USER_LOGOUT");
    await this.sessions.update(session);
  }
}
