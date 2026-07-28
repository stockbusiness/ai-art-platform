import { AdminForbiddenError } from "@ai-art-platform/domain";
import type { Permission } from "@ai-art-platform/domain";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import type { AuthenticatedAdminContext } from "../application/authenticated-admin-context.js";

import { mapAdminAuthErrorToHttp } from "./admin-auth-error.mapper.js";
import { AUTHENTICATED_ADMIN_REQUEST_KEY } from "./current-admin.decorator.js";
import { REQUIRED_PERMISSIONS_KEY } from "./permissions.decorator.js";

interface RequestWithAuthenticatedAdmin extends Request {
  [AUTHENTICATED_ADMIN_REQUEST_KEY]?: AuthenticatedAdminContext;
}

/**
 * Runs after AdminAuthGuard. Enforces the fixed Permission Matrix
 * (section 3.6) declared via `@RequirePermissions(...)` — Role checks
 * never live inline in a Controller method.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (required.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<RequestWithAuthenticatedAdmin>();
    const authenticated = req[AUTHENTICATED_ADMIN_REQUEST_KEY];
    if (!authenticated) {
      throw mapAdminAuthErrorToHttp(new AdminForbiddenError("No authenticated admin on request"));
    }

    const missing = required.filter(
      (permission) => !authenticated.permissions.includes(permission),
    );
    if (missing.length > 0) {
      throw mapAdminAuthErrorToHttp(
        new AdminForbiddenError(`Missing required permission(s): ${missing.join(", ")}`),
      );
    }
    return true;
  }
}
