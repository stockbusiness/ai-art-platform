/** Fixed by section 3.6 of the PR-03A instructions. */
export const PERMISSIONS = [
  "admin:self:read",
  "tenant:read",
  "tenant:update",
  "admin:read",
  "admin:manage",
  "operations:read",
  "operations:write",
  "audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
