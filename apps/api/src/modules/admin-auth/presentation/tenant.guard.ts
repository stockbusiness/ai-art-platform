import { AdminForbiddenError } from "@ai-art-platform/domain";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";

import { requestIdOf } from "../../../infrastructure/http/request-id.js";
import type { AuthenticatedAdminContext } from "../application/authenticated-admin-context.js";

import { mapAdminAuthErrorToHttp } from "./admin-auth-error.mapper.js";
import { AUTHENTICATED_ADMIN_REQUEST_KEY } from "./current-admin.decorator.js";

interface RequestWithAuthenticatedAdmin extends Request {
  [AUTHENTICATED_ADMIN_REQUEST_KEY]?: AuthenticatedAdminContext;
}

/**
 * Reusable guard for future Tenant-scoped endpoints (section 9). PR-03A
 * exposes no route that reads a resource by Tenant, so nothing currently
 * applies this Guard — it exists so later PRs have a single place that
 * enforces "the authenticated Session's tenantId is the only trusted
 * Tenant Context" instead of re-deriving that check per Controller.
 *
 * Deliberately does *not* read `tenantId` from params/query/body/headers
 * at all — a Tenant-scoped route must read
 * `@CurrentAdmin().tenantId` itself; this Guard only blocks callers who
 * have no Tenant context to scope to (SUPER_ADMIN, in PR-03A, since
 * Tenant selection for SUPER_ADMIN is explicitly out of scope — section
 * 9: "SUPER_ADMINがTenantを選択する仕組みも今回実装しない").
 */
@Injectable()
export class AdminTenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithAuthenticatedAdmin>();
    const authenticated = req[AUTHENTICATED_ADMIN_REQUEST_KEY];
    if (!authenticated) {
      throw mapAdminAuthErrorToHttp(
        new AdminForbiddenError("No authenticated admin on request"),
        requestIdOf(req),
      );
    }
    if (authenticated.tenantId === null) {
      throw mapAdminAuthErrorToHttp(
        new AdminForbiddenError(
          "SUPER_ADMIN has no Tenant context; Tenant-scoped access is not implemented in this PR",
        ),
        requestIdOf(req),
      );
    }
    return true;
  }
}
