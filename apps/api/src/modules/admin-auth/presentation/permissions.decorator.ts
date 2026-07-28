import type { Permission } from "@ai-art-platform/domain";
import { SetMetadata } from "@nestjs/common";

export const REQUIRED_PERMISSIONS_KEY = "admin_auth_required_permissions";

/** Marks a route as requiring every listed Permission — enforced by PermissionGuard. */
export const RequirePermissions = (...permissions: Permission[]): MethodDecorator =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
