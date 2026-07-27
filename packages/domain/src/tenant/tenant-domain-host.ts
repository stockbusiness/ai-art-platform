import { DomainError } from "../domain-error.js";
import { err, ok, type Result } from "../result.js";

const HOST_LABEL = "[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?";
const HOST_PATTERN = new RegExp(`^${HOST_LABEL}(\\.${HOST_LABEL})*$`);

export class InvalidTenantDomainHostError extends DomainError {
  readonly code = "TENANT_DOMAIN_HOST_INVALID";
}

/**
 * Value object for a TenantDomain's `host`. Normalizes to lowercase on
 * construction so two hosts that differ only by case compare equal (and
 * collide against the DB's UNIQUE index the same way) — see section 8.4
 * of the PR-02 instructions. Rejects a scheme, a path, a port, and any
 * other non-hostname character; the Repository never receives an
 * unvalidated raw string (see TenantRepository.addTenantDomain).
 */
export class TenantDomainHost {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<TenantDomainHost, InvalidTenantDomainHostError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(new InvalidTenantDomainHostError("Host must not be empty"));
    }
    const normalized = raw.trim().toLowerCase();
    if (normalized.includes("://")) {
      return err(new InvalidTenantDomainHostError(`"${raw}" must not include a scheme`));
    }
    if (normalized.includes("/")) {
      return err(new InvalidTenantDomainHostError(`"${raw}" must not include a path`));
    }
    if (normalized.includes(":")) {
      return err(new InvalidTenantDomainHostError(`"${raw}" must not include a port`));
    }
    if (normalized.length > 255 || !HOST_PATTERN.test(normalized)) {
      return err(new InvalidTenantDomainHostError(`"${raw}" is not a valid hostname`));
    }
    return ok(new TenantDomainHost(normalized));
  }

  toString(): string {
    return this.value;
  }

  equals(other: TenantDomainHost): boolean {
    return this.value === other.value;
  }
}
