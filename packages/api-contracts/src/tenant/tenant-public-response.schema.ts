import { z } from "zod";

import { tenantKeySchema } from "./tenant-key.schema.js";

/**
 * Response body for GET /api/v1/public/tenants/:tenantKey. Deliberately
 * excludes the internal UUID (section 13.1: "内部UUIDをPublic APIへ出す
 * 必要はない").
 */
export const tenantPublicResponseSchema = z.object({
  data: z.object({
    tenantKey: tenantKeySchema,
    name: z.string().min(1).max(120),
    timezone: z.string().min(1),
    defaultLocale: z.string().min(1),
  }),
});

export type TenantPublicResponse = z.infer<typeof tenantPublicResponseSchema>;
