import { describe, expect, it } from "vitest";

import { AdminSession } from "./admin-session.js";

function aSession(now: Date, ttlSeconds = 8 * 60 * 60): AdminSession {
  return AdminSession.create({
    id: "s1",
    adminUserId: "a1",
    tokenHash: "token-hash",
    csrfTokenHash: "csrf-hash",
    ipHash: null,
    userAgentHash: null,
    now,
    ttlSeconds,
  });
}

describe("AdminSession", () => {
  it("computes expiresAt from now + ttlSeconds", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const session = aSession(now, 3600);
    expect(session.expiresAt).toEqual(new Date("2026-01-01T01:00:00Z"));
  });

  describe("expiry", () => {
    it("is not expired before expiresAt", () => {
      const now = new Date("2026-01-01T00:00:00Z");
      const session = aSession(now, 3600);
      expect(session.isExpired(new Date("2026-01-01T00:59:59Z"))).toBe(false);
    });

    it("is expired at or after expiresAt", () => {
      const now = new Date("2026-01-01T00:00:00Z");
      const session = aSession(now, 3600);
      expect(session.isExpired(new Date("2026-01-01T01:00:00Z"))).toBe(true);
      expect(session.isExpired(new Date("2026-01-01T02:00:00Z"))).toBe(true);
    });
  });

  describe("revocation", () => {
    it("is not revoked initially", () => {
      const session = aSession(new Date());
      expect(session.isRevoked()).toBe(false);
    });

    it("is revoked after revoke()", () => {
      const session = aSession(new Date());
      session.revoke(new Date(), "USER_LOGOUT");
      expect(session.isRevoked()).toBe(true);
    });

    it("revoke() is idempotent — a second call does not throw or change the reason", () => {
      const session = aSession(new Date());
      const firstRevokeAt = new Date("2026-01-01T00:00:00Z");
      session.revoke(firstRevokeAt, "USER_LOGOUT");
      expect(() => session.revoke(new Date("2026-01-01T01:00:00Z"), "OTHER")).not.toThrow();
      expect(session.revokedAt).toEqual(firstRevokeAt);
    });
  });

  describe("isValid", () => {
    it("is valid when neither expired nor revoked", () => {
      const now = new Date("2026-01-01T00:00:00Z");
      const session = aSession(now, 3600);
      expect(session.isValid(new Date("2026-01-01T00:30:00Z"))).toBe(true);
    });

    it("is invalid once expired", () => {
      const now = new Date("2026-01-01T00:00:00Z");
      const session = aSession(now, 3600);
      expect(session.isValid(new Date("2026-01-01T01:00:01Z"))).toBe(false);
    });

    it("is invalid once revoked, even if not expired", () => {
      const now = new Date("2026-01-01T00:00:00Z");
      const session = aSession(now, 3600);
      session.revoke(now, "USER_LOGOUT");
      expect(session.isValid(new Date("2026-01-01T00:30:00Z"))).toBe(false);
    });
  });

  describe("CSRF token hash comparison", () => {
    it("matches the hash it was created with", () => {
      const session = aSession(new Date());
      expect(session.matchesCsrfTokenHash("csrf-hash")).toBe(true);
    });

    it("does not match a different hash", () => {
      const session = aSession(new Date());
      expect(session.matchesCsrfTokenHash("wrong-hash")).toBe(false);
    });
  });

  describe("shouldTouch", () => {
    it("is false before the minimum interval has elapsed", () => {
      const now = new Date("2026-01-01T00:00:00Z");
      const session = aSession(now, 3600);
      expect(session.shouldTouch(new Date("2026-01-01T00:04:59Z"), 300)).toBe(false);
    });

    it("is true once the minimum interval has elapsed", () => {
      const now = new Date("2026-01-01T00:00:00Z");
      const session = aSession(now, 3600);
      expect(session.shouldTouch(new Date("2026-01-01T00:05:00Z"), 300)).toBe(true);
    });

    it("updates lastSeenAt after touch()", () => {
      const now = new Date("2026-01-01T00:00:00Z");
      const session = aSession(now, 3600);
      const later = new Date("2026-01-01T00:10:00Z");
      session.touch(later);
      expect(session.lastSeenAt).toEqual(later);
    });
  });
});
