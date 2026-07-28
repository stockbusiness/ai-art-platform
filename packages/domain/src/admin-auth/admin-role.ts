/** Fixed by section 2.2 of the PR-03A instructions — not extensible per-Tenant. */
export const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "TENANT_OWNER",
  "TENANT_ADMIN",
  "STAFF",
  "VIEWER",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

/**
 * Every role except SUPER_ADMIN must belong to exactly one Tenant
 * (section 2.2/3.1). Mirrored by the DB CHECK constraint
 * `admin_users_role_tenant_check`.
 */
export function adminRoleRequiresTenant(role: AdminRole): boolean {
  return role !== "SUPER_ADMIN";
}
