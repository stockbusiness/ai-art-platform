export const ADMIN_STATUSES = ["ACTIVE", "DISABLED"] as const;

export type AdminStatus = (typeof ADMIN_STATUSES)[number];
