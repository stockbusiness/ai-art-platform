import { randomUUID } from "node:crypto";

import { AdminEmail, AdminName, AdminSession, AdminUser } from "@ai-art-platform/domain";
import { describe, expect, it } from "vitest";

import { LogoutAdminUseCase } from "./logout-admin.use-case.js";
import { FakeSessionTokenService } from "./test-fixtures/fake-session-token.service.js";
import { FixedAuthClock } from "./test-fixtures/fixed-auth-clock.js";
import { InMemoryAdminSessionRepository } from "./test-fixtures/in-memory-admin-session.repository.js";

const NOW = new Date("2026-01-01T00:00:00Z");

function anEmail(raw: string): AdminEmail {
  const result = AdminEmail.create(raw);
  if (!result.ok) throw result.error;
  return result.value;
}

function aName(raw: string): AdminName {
  const result = AdminName.create(raw);
  if (!result.ok) throw result.error;
  return result.value;
}

async function seedSession(
  sessions: InMemoryAdminSessionRepository,
  sessionTokens: FakeSessionTokenService,
): Promise<string> {
  const admin = AdminUser.create({
    id: randomUUID(),
    tenantId: null,
    email: anEmail("root@example.com"),
    passwordHash: "hash",
    name: aName("Root"),
    role: "SUPER_ADMIN",
    now: NOW,
  });
  const token = sessionTokens.generateSessionToken();
  const csrf = sessionTokens.generateCsrfToken();
  const session = AdminSession.create({
    id: randomUUID(),
    adminUserId: admin.id,
    tokenHash: token.hash,
    csrfTokenHash: csrf.hash,
    ipHash: null,
    userAgentHash: null,
    now: NOW,
    ttlSeconds: 3600,
  });
  await sessions.create(session);
  return token.raw;
}

describe("LogoutAdminUseCase", () => {
  it("revokes the session identified by the raw token", async () => {
    const sessions = new InMemoryAdminSessionRepository();
    const sessionTokens = new FakeSessionTokenService();
    const clock = new FixedAuthClock(NOW);
    const useCase = new LogoutAdminUseCase(sessions, sessionTokens, clock);
    const rawToken = await seedSession(sessions, sessionTokens);

    await useCase.execute(rawToken);

    const session = await sessions.findByTokenHash(sessionTokens.hash(rawToken));
    expect(session?.isRevoked()).toBe(true);
  });

  it("is a safe no-op for a token that does not resolve to a session", async () => {
    const sessions = new InMemoryAdminSessionRepository();
    const sessionTokens = new FakeSessionTokenService();
    const clock = new FixedAuthClock(NOW);
    const useCase = new LogoutAdminUseCase(sessions, sessionTokens, clock);

    await expect(useCase.execute("never-issued-token")).resolves.toBeUndefined();
  });

  it("is idempotent — revoking an already-revoked session does not throw", async () => {
    const sessions = new InMemoryAdminSessionRepository();
    const sessionTokens = new FakeSessionTokenService();
    const clock = new FixedAuthClock(NOW);
    const useCase = new LogoutAdminUseCase(sessions, sessionTokens, clock);
    const rawToken = await seedSession(sessions, sessionTokens);

    await useCase.execute(rawToken);
    await expect(useCase.execute(rawToken)).resolves.toBeUndefined();
  });
});
