import { AdminUnauthenticatedError } from "@ai-art-platform/domain";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";

import { AuthenticateSessionUseCase } from "../application/authenticate-session.use-case.js";

import { mapAdminAuthErrorToHttp } from "./admin-auth-error.mapper.js";
import { AUTHENTICATED_ADMIN_REQUEST_KEY } from "./current-admin.decorator.js";
import { SESSION_COOKIE_NAME } from "./session-cookies.js";

interface RequestWithAuthenticatedAdmin extends Request {
  [AUTHENTICATED_ADMIN_REQUEST_KEY]?: unknown;
}

/**
 * First Guard on every protected admin-auth route (section 8). Resolves
 * the Session Cookie into an AuthenticatedAdminContext and attaches it to
 * the request for CurrentAdmin/CsrfGuard/PermissionGuard/TenantGuard to
 * use — Controllers never read the Session Cookie themselves.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly authenticateSession: AuthenticateSessionUseCase) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithAuthenticatedAdmin>();
    const rawToken = req.cookies?.[SESSION_COOKIE_NAME] as unknown;
    if (typeof rawToken !== "string" || rawToken.length === 0) {
      throw mapAdminAuthErrorToHttp(new AdminUnauthenticatedError("Missing session cookie"));
    }

    try {
      req[AUTHENTICATED_ADMIN_REQUEST_KEY] = await this.authenticateSession.execute(rawToken);
    } catch (error: unknown) {
      throw mapAdminAuthErrorToHttp(error);
    }
    return true;
  }
}
