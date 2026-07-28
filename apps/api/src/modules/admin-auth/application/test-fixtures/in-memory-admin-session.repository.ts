import type { AdminSession, AdminSessionRepository } from "@ai-art-platform/domain";

/** In-memory AdminSessionRepository test double. */
export class InMemoryAdminSessionRepository implements AdminSessionRepository {
  private byTokenHash = new Map<string, AdminSession>();

  findByTokenHash(tokenHash: string): Promise<AdminSession | null> {
    return Promise.resolve(this.byTokenHash.get(tokenHash) ?? null);
  }

  create(session: AdminSession): Promise<void> {
    this.byTokenHash.set(session.tokenHash, session);
    return Promise.resolve();
  }

  update(session: AdminSession): Promise<void> {
    this.byTokenHash.set(session.tokenHash, session);
    return Promise.resolve();
  }
}
