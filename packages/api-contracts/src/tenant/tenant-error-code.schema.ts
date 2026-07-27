import { z } from "zod";

/**
 * Error codes returned by the Public Tenant Resolve endpoint
 * (GET /api/v1/public/tenants/:tenantKey — section 13.1).
 */
export const tenantErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "TENANT_NOT_FOUND",
  "TENANT_SUSPENDED",
  "DATABASE_UNAVAILABLE",
]);

export type TenantErrorCode = z.infer<typeof tenantErrorCodeSchema>;
