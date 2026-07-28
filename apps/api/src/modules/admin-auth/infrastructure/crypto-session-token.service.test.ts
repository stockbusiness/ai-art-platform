import { describe, expect, it } from "vitest";

import { CryptoSessionTokenService } from "./crypto-session-token.service.js";

describe("CryptoSessionTokenService", () => {
  it("generates a session token with a 64-character hex hash (SHA-256)", () => {
    const service = new CryptoSessionTokenService();
    const token = service.generateSessionToken();
    expect(token.raw.length).toBeGreaterThan(0);
    expect(token.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates a distinct CSRF token", () => {
    const service = new CryptoSessionTokenService();
    const session = service.generateSessionToken();
    const csrf = service.generateCsrfToken();
    expect(csrf.raw).not.toBe(session.raw);
    expect(csrf.hash).not.toBe(session.hash);
  });

  it("generates non-colliding tokens across calls", () => {
    const service = new CryptoSessionTokenService();
    const a = service.generateSessionToken();
    const b = service.generateSessionToken();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });

  it("hash() is deterministic for the same input", () => {
    const service = new CryptoSessionTokenService();
    const token = service.generateSessionToken();
    expect(service.hash(token.raw)).toBe(token.hash);
  });

  it("hash() produces different output for different input", () => {
    const service = new CryptoSessionTokenService();
    expect(service.hash("a")).not.toBe(service.hash("b"));
  });
});
