import { z } from "zod";

import { tenantKeySchema } from "../tenant/tenant-key.schema.js";

/**
 * Request body for POST /api/v1/admin/auth/login (section 3.2). `tenantKey`
 * present ⇒ Tenant-scoped admin login; absent ⇒ SUPER_ADMIN login. Only
 * loose shape/length checks belong here — the real validation (email
 * format, password policy) happens in packages/domain and is intentionally
 * not duplicated here, since a mismatch between the two would only ever
 * surface as the same generic AUTHENTICATION_FAILED response either way.
 */
export const adminLoginRequestSchema = z.object({
  tenantKey: tenantKeySchema.optional(),
  email: z.string().min(1).max(254),
  password: z.string().min(1).max(128),
});

export type AdminLoginRequest = z.infer<typeof adminLoginRequestSchema>;
