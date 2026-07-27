import { DomainError } from "../domain-error.js";

import type { TenantStatus } from "./tenant-status.js";

export class TenantNotFoundError extends DomainError {
  readonly code = "TENANT_NOT_FOUND";
}

export class TenantSuspendedError extends DomainError {
  readonly code = "TENANT_SUSPENDED";
}

export class TenantKeyAlreadyExistsError extends DomainError {
  readonly code = "TENANT_KEY_ALREADY_EXISTS";
}

export class InvalidTenantNameError extends DomainError {
  readonly code = "TENANT_NAME_INVALID";
}

export class TenantStatusTransitionError extends DomainError {
  readonly code = "TENANT_STATUS_TRANSITION_INVALID";

  constructor(from: TenantStatus, to: TenantStatus) {
    super(`Cannot transition tenant status from ${from} to ${to}`);
  }
}

export class TenantDomainAlreadyExistsError extends DomainError {
  readonly code = "TENANT_DOMAIN_ALREADY_EXISTS";
}

export class PrimaryTenantDomainAlreadyExistsError extends DomainError {
  readonly code = "PRIMARY_TENANT_DOMAIN_ALREADY_EXISTS";
}
