import { z } from "zod";

/** Mirrors packages/domain's AdminRole (section 2.2 of the PR-03A instructions). */
export const adminRoleSchema = z.enum([
  "SUPER_ADMIN",
  "TENANT_OWNER",
  "TENANT_ADMIN",
  "STAFF",
  "VIEWER",
]);

export type AdminRoleContract = z.infer<typeof adminRoleSchema>;
