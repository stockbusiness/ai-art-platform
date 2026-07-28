export const PASSWORD_HASHER = "PASSWORD_HASHER";

/**
 * Port for password hashing (section 3.3: Argon2id). Kept as an interface
 * so the Application layer's use cases never import `argon2` directly —
 * only apps/api/.../infrastructure/argon2-password-hasher.ts does.
 */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
  /**
   * Runs a verify of the same cost as `verify()`, against a fixed dummy
   * hash that never matches any real admin's password. Used to equalize
   * timing on 401 paths where no real password hash exists yet to check
   * against (unknown email, missing/suspended tenant, missing/disabled
   * admin) — section 3.2's "外部応答では...区別しない" extended from the
   * response body to response timing. The return value is always
   * discarded by callers; it exists only for its side effect (CPU time).
   */
  verifyDummy(password: string): Promise<boolean>;
}
