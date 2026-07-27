import { DomainError } from "../domain-error.js";
import { err, ok, type Result } from "../result.js";

/**
 * 3-50 lowercase alphanumeric characters or hyphens, no leading/trailing
 * hyphen. Fixed by the PR-02 instructions (section 9.1) — enforced here
 * and again as a DB constraint, since a client can bypass the domain
 * layer only by going around the API entirely.
 */
const TENANT_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,48})[a-z0-9]$/;

export class InvalidTenantKeyError extends DomainError {
  readonly code = "TENANT_KEY_INVALID";
}

/**
 * Value object for a Tenant's public, immutable-after-creation slug.
 * Equality is by value, not identity (unlike Entity).
 */
export class TenantKey {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<TenantKey, InvalidTenantKeyError> {
    if (!TENANT_KEY_PATTERN.test(raw)) {
      return err(
        new InvalidTenantKeyError(
          `"${raw}" is not a valid tenant key: expected 3-50 lowercase alphanumeric characters or hyphens, with no leading or trailing hyphen`,
        ),
      );
    }
    return ok(new TenantKey(raw));
  }

  toString(): string {
    return this.value;
  }

  equals(other: TenantKey): boolean {
    return this.value === other.value;
  }
}
