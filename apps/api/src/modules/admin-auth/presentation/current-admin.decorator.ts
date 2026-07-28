import { createParamDecorator, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import type { AuthenticatedAdminContext } from "../application/authenticated-admin-context.js";

export const AUTHENTICATED_ADMIN_REQUEST_KEY = "authenticatedAdmin";

interface RequestWithAuthenticatedAdmin extends Request {
  [AUTHENTICATED_ADMIN_REQUEST_KEY]?: AuthenticatedAdminContext;
}

/**
 * Injects the AuthenticatedAdminContext that AdminAuthGuard attached to
 * the request. Throws if used on a route without AdminAuthGuard — this is
 * a programmer error, not a runtime auth failure, but fails safely (401)
 * rather than returning undefined.
 */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedAdminContext => {
    const req = ctx.switchToHttp().getRequest<RequestWithAuthenticatedAdmin>();
    const authenticated = req[AUTHENTICATED_ADMIN_REQUEST_KEY];
    if (!authenticated) {
      throw new UnauthorizedException(
        "No authenticated admin on request — is AdminAuthGuard applied?",
      );
    }
    return authenticated;
  },
);
