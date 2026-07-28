import { z } from "zod";

import { adminRoleSchema } from "./admin-role.schema.js";

/**
 * The only Admin shape ever returned to a client (Login response and
 * GET /me — section 7.1/7.2). Deliberately excludes passwordHash, Session
 * Token, CSRF Token, IP, and User-Agent.
 */
export const adminSummarySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid().nullable(),
  tenantKey: z.string().nullable(),
  email: z.string(),
  name: z.string(),
  role: adminRoleSchema,
});

export type AdminSummary = z.infer<typeof adminSummarySchema>;
