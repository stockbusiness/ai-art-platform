import { AdminForbiddenError } from "@ai-art-platform/domain";
import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";

import { requestIdOf } from "../../../infrastructure/http/request-id.js";
import type { AuthenticatedAdminContext } from "../application/authenticated-admin-context.js";
import {
  SESSION_TOKEN_PORT,
  type SessionTokenPort,
} from "../domain-services/session-token.port.js";
import { timingSafeStringEqual } from "../infrastructure/timing-safe-equal.js";

import { mapAdminAuthErrorToHttp } from "./admin-auth-error.mapper.js";
import { AUTHENTICATED_ADMIN_REQUEST_KEY } from "./current-admin.decorator.js";
import { CSRF_COOKIE_NAME } from "./session-cookies.js";

const CSRF_HEADER_NAME = "x-csrf-token";

interface RequestWithAuthenticatedAdmin extends Request {
  [AUTHENTICATED_ADMIN_REQUEST_KEY]?: AuthenticatedAdminContext;
}

/**
 * Runs after AdminAuthGuard. Verifies the CSRF Cookie value, the
 * `X-CSRF-Token` Header value, and the DB-stored hash all agree (section
 * 3.4). Only applied to state-changing routes — GET/HEAD/OPTIONS and
 * Login never require it (section 3.4).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(SESSION_TOKEN_PORT) private readonly sessionTokens: SessionTokenPort) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithAuthenticatedAdmin>();
    const authenticated = req[AUTHENTICATED_ADMIN_REQUEST_KEY];
    if (!authenticated) {
      // Programmer error (CsrfGuard applied without AdminAuthGuard first)
      // — fail closed rather than silently allowing the request through.
      throw mapAdminAuthErrorToHttp(
        new AdminForbiddenError("No authenticated admin on request"),
        requestIdOf(req),
      );
    }

    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME] as unknown;
    const headerToken = req.headers[CSRF_HEADER_NAME];

    if (
      typeof cookieToken !== "string" ||
      cookieToken.length === 0 ||
      typeof headerToken !== "string" ||
      headerToken.length === 0
    ) {
      throw mapAdminAuthErrorToHttp(
        new AdminForbiddenError("Missing CSRF token"),
        requestIdOf(req),
      );
    }

    if (!timingSafeStringEqual(cookieToken, headerToken)) {
      throw mapAdminAuthErrorToHttp(
        new AdminForbiddenError("CSRF token mismatch"),
        requestIdOf(req),
      );
    }

    if (!timingSafeStringEqual(this.sessionTokens.hash(cookieToken), authenticated.csrfTokenHash)) {
      throw mapAdminAuthErrorToHttp(
        new AdminForbiddenError("CSRF token does not match session"),
        requestIdOf(req),
      );
    }

    return true;
  }
}
