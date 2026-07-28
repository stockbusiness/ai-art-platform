import type { PasswordHasher } from "../../domain-services/password-hasher.port.js";

/**
 * Deterministic, fast fake — never uses real Argon2 in unit tests (which
 * would make the suite slow for no benefit; hashing correctness is
 * verified once, directly, in argon2-password-hasher.test.ts).
 */
export class FakePasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return Promise.resolve(`fake-hash:${password}`);
  }

  verify(hash: string, password: string): Promise<boolean> {
    return Promise.resolve(hash === `fake-hash:${password}`);
  }
}
