import type { AdminSession } from "./admin-session.js";

export const ADMIN_SESSION_REPOSITORY = "ADMIN_SESSION_REPOSITORY";

/**
 * Port for AdminSession persistence. Implemented in
 * apps/api/src/modules/admin-auth/infrastructure by a Prisma-backed
 * adapter — this interface must stay free of Prisma/HTTP types.
 */
export interface AdminSessionRepository {
  findByTokenHash(tokenHash: string): Promise<AdminSession | null>;
  create(session: AdminSession): Promise<void>;
  /** Persists mutable state changes (lastSeenAt, revokedAt/revokeReason). */
  update(session: AdminSession): Promise<void>;
}
