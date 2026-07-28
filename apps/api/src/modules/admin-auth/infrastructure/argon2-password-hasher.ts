import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";

import type { PasswordHasher } from "../domain-services/password-hasher.port.js";

/**
 * Never a real admin's password — used only to give `verifyDummy()` a
 * valid Argon2id hash to spend CPU time against on 401 paths where no
 * real admin/hash exists yet.
 */
const DUMMY_PASSWORD = "dummy-password-for-login-timing-equalization-only";

/**
 * Argon2id, per section 3.3. `argon2.hash()` defaults to type `argon2id`
 * in this library — asserted explicitly here so a future library upgrade
 * changing that default cannot silently weaken it.
 */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  // Computed lazily (not hardcoded) so its cost/format always matches
  // whatever this.hash() actually produces, and cached so only the first
  // call in the process pays the extra hash-generation cost — every
  // subsequent verifyDummy() call is a normal verify() against it.
  private dummyHashPromise: Promise<string> | null = null;

  async hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      // A malformed/foreign hash string throws rather than returning
      // false — treat that identically to "does not match" so it can
      // never distinguish "wrong password" from "corrupted hash" for a
      // caller (see AdminAuthenticationFailedError's genericity).
      return false;
    }
  }

  async verifyDummy(password: string): Promise<boolean> {
    const dummyHash = await this.getDummyHash();
    return this.verify(dummyHash, password);
  }

  private getDummyHash(): Promise<string> {
    this.dummyHashPromise ??= argon2.hash(DUMMY_PASSWORD, { type: argon2.argon2id });
    return this.dummyHashPromise;
  }
}
