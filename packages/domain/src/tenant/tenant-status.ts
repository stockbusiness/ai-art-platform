export const TENANT_STATUSES = ["ACTIVE", "SUSPENDED"] as const;

export type TenantStatus = (typeof TENANT_STATUSES)[number];

const ALLOWED_TRANSITIONS: Readonly<Record<TenantStatus, readonly TenantStatus[]>> = {
  ACTIVE: ["SUSPENDED"],
  SUSPENDED: ["ACTIVE"],
};

/**
 * PR-02 exposes only ACTIVE <-> SUSPENDED (section 9.2). Physical deletion
 * is deliberately not modeled here.
 */
export function canTransitionTenantStatus(from: TenantStatus, to: TenantStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
