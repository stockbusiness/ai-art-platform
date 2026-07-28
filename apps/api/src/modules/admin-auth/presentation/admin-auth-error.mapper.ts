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
  requestId: string,
): { error: { code: AdminAuthErrorCode; message: string; requestId: string } } {
  return { error: { code, message, requestId } };
}

/**
 * Maps every admin-auth Domain error to its HTTP shape. `requestId` must
 * be the same ID already threaded into the triggering UseCase (and, for a
 * Login attempt, into `admin_login_events.request_id`) — see
 * `requestIdOf()` — so a client-visible failure and its server-side audit
 * row always carry an identical ID (review-fix P0-6).
 *
 * Deliberately narrow for the *known* Domain errors:
 * AdminAuthenticationFailedError and AdminTooManyAttemptsError are the
 * *only* failure shapes POST /login may return (section 7.1) — never a
 * distinct VALIDATION_ERROR, so a malformed request body cannot be
 * distinguished from a wrong password. Anything else — a value this
 * function has never seen before — is, by construction, an *unexpected*
 * failure (DB unreachable, a Prisma/transaction error, ...) and must
 * never be reported as UNAUTHENTICATED: that would let a real outage
 * masquerade as "you are not logged in" (review-fix P0-7). It becomes
 * AUTH_SERVICE_UNAVAILABLE / 503 instead, with no internal detail (no
 * SQL, host, or stack trace) in the response body.
 */
export function mapAdminAuthErrorToHttp(error: unknown, requestId: string): HttpException {
  if (error instanceof AdminAuthenticationFailedError) {
    return new HttpException(
      errorBody("AUTHENTICATION_FAILED", "Authentication failed", requestId),
      401,
    );
  }
  if (error instanceof AdminTooManyAttemptsError) {
    return new HttpException(errorBody("TOO_MANY_ATTEMPTS", "Too many attempts", requestId), 429);
  }
  if (error instanceof AdminUnauthenticatedError) {
    return new HttpException(
      errorBody("UNAUTHENTICATED", "Authentication required", requestId),
      401,
    );
  }
  if (error instanceof AdminForbiddenError) {
    return new HttpException(errorBody("FORBIDDEN", "Forbidden", requestId), 403);
  }
  return new HttpException(
    errorBody("AUTH_SERVICE_UNAVAILABLE", "Service temporarily unavailable", requestId),
    503,
  );
}
