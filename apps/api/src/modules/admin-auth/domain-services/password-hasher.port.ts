export const PASSWORD_HASHER = "PASSWORD_HASHER";

/**
 * Port for password hashing (section 3.3: Argon2id). Kept as an interface
 * so the Application layer's use cases never import `argon2` directly —
 * only apps/api/.../infrastructure/argon2-password-hasher.ts does.
 */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}
