export const SESSION_TOKEN_PORT = "SESSION_TOKEN_PORT";

export interface GeneratedToken {
  /** The value set on a Cookie — never persisted. */
  raw: string;
  /** SHA-256 hex digest of `raw` — the only form ever persisted. */
  hash: string;
}

/**
 * Port for generating and hashing Opaque Session/CSRF Tokens (section
 * 3.4). `hash()` is exposed separately so Guards can hash an incoming
 * Cookie/Header value to compare against a stored hash without generating
 * a new token.
 */
export interface SessionTokenPort {
  generateSessionToken(): GeneratedToken;
  generateCsrfToken(): GeneratedToken;
  hash(raw: string): string;
}
