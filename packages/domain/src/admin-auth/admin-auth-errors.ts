import { DomainError } from "../domain-error.js";

export class InvalidAdminEmailError extends DomainError {
  readonly code = "ADMIN_EMAIL_INVALID";
}

export class InvalidAdminNameError extends DomainError {
  readonly code = "ADMIN_NAME_INVALID";
}

export class InvalidAdminPasswordError extends DomainError {
  readonly code = "ADMIN_PASSWORD_INVALID";
}

export class AdminRoleTenantMismatchError extends DomainError {
  readonly code = "ADMIN_ROLE_TENANT_MISMATCH";
}

/**
 * A duplicate (tenantId, email) — or a duplicate email among SUPER_ADMIN
 * rows — was rejected by the Repository (section 11: "重複Adminは失敗").
 * Only ever thrown by the Bootstrap CLI path in PR-03A; there is no public
 * Admin-create HTTP endpoint yet.
 */
export class AdminAlreadyExistsError extends DomainError {
  readonly code = "ADMIN_ALREADY_EXISTS";
}

/**
 * The single error thrown for every login failure that must be reported
 * identically to the caller — unknown tenant, unknown email, wrong
 * password, disabled account (section 3.2: "外部応答では、ユーザー不存在、
 * Tenant不存在、パスワード不一致、停止状態を区別しない"). The real reason
 * is recorded server-side only (admin_login_events.failure_reason).
 */
export class AdminAuthenticationFailedError extends DomainError {
  readonly code = "AUTHENTICATION_FAILED";
}

/** Account lockout or IP-level rate limiting — reported as 429, not 401. */
export class AdminTooManyAttemptsError extends DomainError {
  readonly code = "TOO_MANY_ATTEMPTS";
}

/**
 * Session could not be authenticated: missing/malformed cookie, unknown,
 * expired, or revoked session token, or an Admin that no longer exists or
 * is DISABLED. Deliberately generic — see AdminAuthGuard.
 */
export class AdminUnauthenticatedError extends DomainError {
  readonly code = "UNAUTHENTICATED";
}

/**
 * Session was authenticated, but the caller is not allowed to perform the
 * requested action: suspended Tenant, missing permission, invalid CSRF
 * token, or a structurally inconsistent role/tenant combination.
 */
export class AdminForbiddenError extends DomainError {
  readonly code = "FORBIDDEN";
}
