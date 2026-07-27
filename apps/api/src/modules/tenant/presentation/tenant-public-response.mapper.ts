import type { TenantPublicResponse } from "@ai-art-platform/api-contracts";
import type { Tenant } from "@ai-art-platform/domain";

/** Deliberately omits the internal UUID (id) — see section 13.1. */
export function toTenantPublicResponse(tenant: Tenant): TenantPublicResponse {
  return {
    data: {
      tenantKey: tenant.tenantKey.toString(),
      name: tenant.name,
      timezone: tenant.timezone,
      defaultLocale: tenant.defaultLocale,
    },
  };
}
