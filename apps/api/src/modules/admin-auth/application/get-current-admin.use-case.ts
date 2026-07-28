import type { AdminSummary } from "@ai-art-platform/api-contracts";
import { Injectable } from "@nestjs/common";

import type { AuthenticatedAdminContext } from "./authenticated-admin-context.js";

/**
 * Backs GET /api/v1/admin/auth/me. Pure mapping — AdminAuthGuard has
 * already loaded fresh Admin/Tenant state for this request, so no
 * additional Repository call is needed here.
 */
@Injectable()
export class GetCurrentAdminUseCase {
  execute(context: AuthenticatedAdminContext): AdminSummary {
    return {
      id: context.adminId,
      tenantId: context.tenantId,
      tenantKey: context.tenantKey,
      email: context.email,
      name: context.name,
      role: context.role,
    };
  }
}
