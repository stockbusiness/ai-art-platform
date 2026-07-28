import type { Prisma } from "@ai-art-platform/database";
import { AdminSession } from "@ai-art-platform/domain";

type PersistedAdminSession = {
  id: string;
  adminUserId: string;
  tokenHash: string;
  csrfTokenHash: string;
  expiresAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
  ipHash: string | null;
  userAgentHash: string | null;
  createdAt: Date;
};

export function toDomainAdminSession(row: PersistedAdminSession): AdminSession {
  return AdminSession.reconstitute({
    id: row.id,
    adminUserId: row.adminUserId,
    tokenHash: row.tokenHash,
    csrfTokenHash: row.csrfTokenHash,
    expiresAt: row.expiresAt,
    lastSeenAt: row.lastSeenAt,
    revokedAt: row.revokedAt,
    revokeReason: row.revokeReason,
    ipHash: row.ipHash,
    userAgentHash: row.userAgentHash,
    createdAt: row.createdAt,
  });
}

export function toCreateInput(
  session: AdminSession,
  ipHash: string | null,
  userAgentHash: string | null,
): Prisma.AdminSessionCreateInput {
  return {
    id: session.id,
    adminUser: { connect: { id: session.adminUserId } },
    tokenHash: session.tokenHash,
    csrfTokenHash: session.csrfTokenHash,
    expiresAt: session.expiresAt,
    lastSeenAt: session.lastSeenAt,
    revokedAt: session.revokedAt,
    revokeReason: session.revokeReason,
    ipHash,
    userAgentHash,
  };
}

export function toUpdateInput(session: AdminSession): Prisma.AdminSessionUpdateInput {
  return {
    lastSeenAt: session.lastSeenAt,
    revokedAt: session.revokedAt,
    revokeReason: session.revokeReason,
  };
}
