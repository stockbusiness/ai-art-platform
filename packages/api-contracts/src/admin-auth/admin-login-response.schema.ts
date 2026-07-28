import { z } from "zod";

import { adminSummarySchema } from "./admin-summary.schema.js";

export const adminLoginResponseSchema = z.object({
  data: z.object({
    admin: adminSummarySchema,
  }),
});

export type AdminLoginResponse = z.infer<typeof adminLoginResponseSchema>;
