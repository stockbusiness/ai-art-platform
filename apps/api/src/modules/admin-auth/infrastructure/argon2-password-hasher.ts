import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";

import type { PasswordHasher } from "../domain-services/password-hasher.port.js";

/**
 * Argon2id, per section 3.3. `argon2.hash()` defaults to type `argon2id`
 * in this library — asserted explicitly here so a future library upgrade
 * changing that default cannot silently weaken it.
 */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
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
}
