import { err, ok, type Result } from "../result.js";

import { InvalidAdminNameError } from "./admin-auth-errors.js";

/** Matches the DB column's VARCHAR(120) limit (admin_users.name). */
const MAX_NAME_LENGTH = 120;

/** Value object for an Admin's display name. */
export class AdminName {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<AdminName, InvalidAdminNameError> {
    if (raw.length === 0 || raw.trim().length === 0) {
      return err(new InvalidAdminNameError("Admin name must not be empty or whitespace-only"));
    }
    if (raw.length > MAX_NAME_LENGTH) {
      return err(
        new InvalidAdminNameError(
          `Admin name must be at most ${MAX_NAME_LENGTH} characters (got ${raw.length})`,
        ),
      );
    }
    return ok(new AdminName(raw));
  }

  toString(): string {
    return this.value;
  }

  equals(other: AdminName): boolean {
    return this.value === other.value;
  }
}
