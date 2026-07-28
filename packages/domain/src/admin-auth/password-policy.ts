import { err, ok, type Result } from "../result.js";

import { InvalidAdminPasswordError } from "./admin-auth-errors.js";
import type { AdminEmail } from "./admin-email.js";

const MIN_LENGTH = 12;
const MAX_LENGTH = 128;

/**
 * Validates a candidate password against section 3.3's Password Policy.
 * Deliberately a pure function, not a value object that retains the raw
 * password — nothing in the Domain layer should hold a plaintext password
 * any longer than the single check it needs (see also
 * password-hasher.port.ts in apps/api's Infrastructure layer, which hashes
 * it immediately after this passes).
 *
 * The raw password is validated as-is — it is never trimmed before being
 * checked or hashed (section 3.3: "Passwordをtrimして保存しない").
 */
export function validateAdminPassword(
  password: string,
  email: AdminEmail,
): Result<void, InvalidAdminPasswordError> {
  if (password.length < MIN_LENGTH) {
    return err(new InvalidAdminPasswordError(`Password must be at least ${MIN_LENGTH} characters`));
  }
  if (password.length > MAX_LENGTH) {
    return err(new InvalidAdminPasswordError(`Password must be at most ${MAX_LENGTH} characters`));
  }
  if (password.trim().length === 0) {
    return err(new InvalidAdminPasswordError("Password must not be whitespace-only"));
  }
  if (password === email.toString()) {
    return err(new InvalidAdminPasswordError("Password must not be the same as the admin email"));
  }
  return ok(undefined);
}
