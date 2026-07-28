import type { AdminRole } from "./admin-role.js";
import { PERMISSIONS, type Permission } from "./permission.js";

/**
 * Fixed Permission Matrix (section 3.6). Role → Permission checks must go
 * through `roleHasPermission()` rather than being re-implemented ad hoc in
 * a Controller — see PermissionGuard in apps/api's presentation layer.
 * `admin:manage` exists in the matrix but PR-03A exposes no endpoint that
 * requires it (no Admin create/edit API is published yet).
 */
export const ROLE_PERMISSIONS: Readonly<Record<AdminRole, readonly Permission[]>> = {
  SUPER_ADMIN: [...PERMISSIONS],
  TENANT_OWNER: [
    "admin:self:read",
    "tenant:read",
    "tenant:update",
    "admin:read",
    "admin:manage",
    "operations:read",
    "operations:write",
    "audit:read",
  ],
  TENANT_ADMIN: [
    "admin:self:read",
    "tenant:read",
    "tenant:update",
    "admin:read",
    "operations:read",
    "operations:write",
    "audit:read",
  ],
  STAFF: ["admin:self:read", "tenant:read", "operations:read", "operations:write"],
  VIEWER: ["admin:self:read", "tenant:read", "operations:read"],
};

export function roleHasPermission(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
