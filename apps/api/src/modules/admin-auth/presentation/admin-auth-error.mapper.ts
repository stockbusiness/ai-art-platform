import { randomUUID } from "node:crypto";

import type { AdminAuthErrorCode } from "@ai-art-platform/api-contracts";
import {
  AdminAuthenticationFailedError,
  AdminForbiddenError,
  AdminTooManyAttemptsError,
  AdminUnauthenticatedError,
} from "@ai-art-platform/domain";
import { HttpException } from "@nestjs/common";

function errorBody(
  code: AdminAuthErrorCode,
  message: string,
): { error: { code: AdminAuthErrorCode; message: string; requestId: string } } {
  return { error: { code, message, requestId: randomUUID() } };
}

/**
 * Maps every admin-auth Domain error to its HTTP shape. Deliberately
 * narrow: AdminAuthenticationFailedError and AdminTooManyAttemptsError are
 * the *only* failure shapes POST /login may return (section 7.1) — never
 * a distinct VALIDATION_ERROR, so a malformed request body cannot be
 * distinguished from a wrong password.
 */
export function mapAdminAuthErrorToHttp(error: unknown): HttpException {
  if (error instanceof AdminAuthenticationFailedError) {
    return new HttpException(errorBody("AUTHENTICATION_FAILED", "Authentication failed"), 401);
  }
  if (error instanceof AdminTooManyAttemptsError) {
    return new HttpException(errorBody("TOO_MANY_ATTEMPTS", "Too many attempts"), 429);
  }
  if (error instanceof AdminUnauthenticatedError) {
    return new HttpException(errorBody("UNAUTHENTICATED", "Authentication required"), 401);
  }
  if (error instanceof AdminForbiddenError) {
    return new HttpException(errorBody("FORBIDDEN", "Forbidden"), 403);
  }
  // Any other failure (DB unreachable, unexpected error) must not leak
  // connection details, SQL, or a stack trace. UNAUTHENTICATED (rather
  // than a 500) keeps the response shape identical to every other "we
  // could not establish who you are" case.
  return new HttpException(errorBody("UNAUTHENTICATED", "Authentication required"), 401);
}
