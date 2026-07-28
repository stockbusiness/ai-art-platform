import type { GeneratedToken, SessionTokenPort } from "../../domain-services/session-token.port.js";

/** Deterministic fake — `hash(raw)` is just `"hash:" + raw`, not real SHA-256. */
export class FakeSessionTokenService implements SessionTokenPort {
  private counter = 0;

  generateSessionToken(): GeneratedToken {
    this.counter += 1;
    const raw = `session-token-${this.counter}`;
    return { raw, hash: this.hash(raw) };
  }

  generateCsrfToken(): GeneratedToken {
    this.counter += 1;
    const raw = `csrf-token-${this.counter}`;
    return { raw, hash: this.hash(raw) };
  }

  hash(raw: string): string {
    return `hash:${raw}`;
  }
}
