import { z } from "zod";

/**
 * Error codes returned by the admin-auth endpoints
 * (POST /api/v1/admin/auth/login, GET /api/v1/admin/auth/me,
 * POST /api/v1/admin/auth/logout — section 7). AUTHENTICATION_FAILED is
 * deliberately generic: it covers unknown tenant, unknown email, wrong
 * password, and a disabled account alike (section 3.2).
 */
export const adminAuthErrorCodeSchema = z.enum([
  "AUTHENTICATION_FAILED",
  "TOO_MANY_ATTEMPTS",
  "UNAUTHENTICATED",
  "FORBIDDEN",
]);

export type AdminAuthErrorCode = z.infer<typeof adminAuthErrorCodeSchema>;
