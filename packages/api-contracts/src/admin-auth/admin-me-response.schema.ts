import { z } from "zod";

import { adminSummarySchema } from "./admin-summary.schema.js";

/** Response body for GET /api/v1/admin/auth/me (section 7.2). */
export const adminMeResponseSchema = z.object({
  data: z.object({
    admin: adminSummarySchema,
  }),
});

export type AdminMeResponse = z.infer<typeof adminMeResponseSchema>;
