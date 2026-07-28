import { Entity } from "../entity.js";

export interface AdminSessionProps {
  id: string;
  adminUserId: string;
  /** SHA-256 hex digest — the raw token is never held by the Domain layer. */
  tokenHash: string;
  csrfTokenHash: string;
  expiresAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
  ipHash: string | null;
  userAgentHash: string | null;
  createdAt: Date;
}

export interface CreateAdminSessionInput {
  id: string;
  adminUserId: string;
  tokenHash: string;
  csrfTokenHash: string;
  ipHash: string | null;
  userAgentHash: string | null;
  now: Date;
  ttlSeconds: number;
}

export class AdminSession extends Entity<string> {
  private props: AdminSessionProps;

  private constructor(props: AdminSessionProps) {
    super(props.id);
    this.props = props;
  }

  static create(input: CreateAdminSessionInput): AdminSession {
    return new AdminSession({
      id: input.id,
      adminUserId: input.adminUserId,
      tokenHash: input.tokenHash,
      csrfTokenHash: input.csrfTokenHash,
      expiresAt: new Date(input.now.getTime() + input.ttlSeconds * 1000),
      lastSeenAt: input.now,
      revokedAt: null,
      revokeReason: null,
      ipHash: input.ipHash,
      userAgentHash: input.userAgentHash,
      createdAt: input.now,
    });
  }

  /** Rehydrates an AdminSession from persisted state — never validates business rules. */
  static reconstitute(props: AdminSessionProps): AdminSession {
    return new AdminSession(props);
  }

  get adminUserId(): string {
    return this.props.adminUserId;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get csrfTokenHash(): string {
    return this.props.csrfTokenHash;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get lastSeenAt(): Date {
    return this.props.lastSeenAt;
  }

  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }

  get revokeReason(): string | null {
    return this.props.revokeReason;
  }

  get ipHash(): string | null {
    return this.props.ipHash;
  }

  get userAgentHash(): string | null {
    return this.props.userAgentHash;
  }

  isExpired(now: Date): boolean {
    return this.props.expiresAt.getTime() <= now.getTime();
  }

  isRevoked(): boolean {
    return this.props.revokedAt !== null;
  }

  /** True only when the session is neither expired nor revoked (section 3.4). */
  isValid(now: Date): boolean {
    return !this.isExpired(now) && !this.isRevoked();
  }

  matchesCsrfTokenHash(hash: string): boolean {
    return this.props.csrfTokenHash === hash;
  }

  /**
   * Section 3.4: "最終アクセス更新: 最大5分に1回" — callers should only
   * invoke this (and persist the result) when at least `minIntervalSeconds`
   * has elapsed since `lastSeenAt`, to avoid a DB write on every request.
   */
  shouldTouch(now: Date, minIntervalSeconds: number): boolean {
    return now.getTime() - this.props.lastSeenAt.getTime() >= minIntervalSeconds * 1000;
  }

  touch(now: Date): void {
    this.props.lastSeenAt = now;
  }

  revoke(now: Date, reason: string): void {
    if (this.props.revokedAt !== null) {
      return;
    }
    this.props.revokedAt = now;
    this.props.revokeReason = reason;
  }
}
