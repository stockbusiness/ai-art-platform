import type { DbTransactionHandle } from "./admin-user-repository.js";

/**
 * Mirrors the DB enum AdminLoginFailureReason — recorded for audit only,
 * never returned to the caller as-is (see AdminAuthenticationFailedError /
 * AdminTooManyAttemptsError, which are the only failure shapes an external
 * response may carry).
 */
export const ADMIN_LOGIN_FAILURE_REASONS = [
  "INVALID_CREDENTIALS",
  "TENANT_UNAVAILABLE",
  "ACCOUNT_DISABLED",
  "ACCOUNT_LOCKED",
  "IP_RATE_LIMITED",
] as const;

export type AdminLoginFailureReason = (typeof ADMIN_LOGIN_FAILURE_REASONS)[number];

export interface RecordAdminLoginEventInput {
  id: string;
  adminUserId: string | null;
  tenantId: string | null;
  /** HMAC-SHA256(AUTH_IP_HASH_SECRET, normalizedEmail) — never plaintext. */
  emailHash: string;
  success: boolean;
  failureReason: AdminLoginFailureReason | null;
  ipHash: string | null;
  userAgentHash: string | null;
  requestId: string;
  now: Date;
}

export const ADMIN_LOGIN_EVENT_REPOSITORY = "ADMIN_LOGIN_EVENT_REPOSITORY";

/**
 * Port for the append-only Admin login audit log. No update/delete —
 * every row is immutable once written.
 */
export interface AdminLoginEventRepository {
  record(input: RecordAdminLoginEventInput, tx?: DbTransactionHandle): Promise<void>;
  /**
   * Counts failed login attempts from a given IP hash within the last
   * `windowSeconds`, for the IP-level rate limit (section 3.5).
   */
  countRecentFailuresByIpHash(
    ipHash: string,
    now: Date,
    windowSeconds: number,
    tx?: DbTransactionHandle,
  ): Promise<number>;
  /**
   * Serializes concurrent login attempts from the same `ipHash` within the
   * current DB transaction — a Postgres session-level advisory lock
   * (`pg_advisory_xact_lock`) scoped to `tx`, released automatically at
   * commit/rollback. Must be called (and awaited) before
   * `countRecentFailuresByIpHash` so the count-then-record sequence for
   * one IP can never race with another attempt from the same IP; distinct
   * IP hashes never block each other (P0-4).
   */
  acquireIpRateLimitLock(ipHash: string, tx: DbTransactionHandle): Promise<void>;
}
