import type { PasswordHasher } from "../../domain-services/password-hasher.port.js";

/**
 * Deterministic, fast fake — never uses real Argon2 in unit tests (which
 * would make the suite slow for no benefit; hashing correctness is
 * verified once, directly, in argon2-password-hasher.test.ts).
 *
 * Tracks call counts so LoginAdminUseCase tests can assert exactly which
 * 401 paths call `verify()` vs `verifyDummy()` (P0-2: timing equalization).
 */
export class FakePasswordHasher implements PasswordHasher {
  verifyCallCount = 0;
  verifyDummyCallCount = 0;

  hash(password: string): Promise<string> {
    return Promise.resolve(`fake-hash:${password}`);
  }

  verify(hash: string, password: string): Promise<boolean> {
    this.verifyCallCount += 1;
    return Promise.resolve(hash === `fake-hash:${password}`);
  }

  verifyDummy(_password: string): Promise<boolean> {
    this.verifyDummyCallCount += 1;
    return Promise.resolve(false);
  }
}
