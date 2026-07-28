import { err, ok, type Result } from "../result.js";

import { InvalidAdminEmailError } from "./admin-auth-errors.js";

/** Matches the DB column's VARCHAR(254) limit (admin_users.email). */
const MAX_EMAIL_LENGTH = 254;

/**
 * Deliberately simple (not full RFC 5322) — this is a sanity check, not an
 * attempt to reject every malformed-but-technically-legal address. Actual
 * deliverability is out of scope for PR-03A (no email-sending feature
 * exists yet).
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Value object for an Admin's login email. Always normalized (trim +
 * lowercase) before validation, matching the DB CHECK constraint
 * `admin_users_email_normalized_check` — a caller that bypasses the
 * Domain layer cannot store a non-normalized email either.
 */
export class AdminEmail {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<AdminEmail, InvalidAdminEmailError> {
    const normalized = raw.trim().toLowerCase();
    if (normalized.length === 0) {
      return err(new InvalidAdminEmailError("Admin email must not be empty"));
    }
    if (normalized.length > MAX_EMAIL_LENGTH) {
      return err(
        new InvalidAdminEmailError(`Admin email must be at most ${MAX_EMAIL_LENGTH} characters`),
      );
    }
    if (!EMAIL_PATTERN.test(normalized)) {
      return err(new InvalidAdminEmailError("Admin email is not a valid email address"));
    }
    return ok(new AdminEmail(normalized));
  }

  toString(): string {
    return this.value;
  }

  equals(other: AdminEmail): boolean {
    return this.value === other.value;
  }
}
