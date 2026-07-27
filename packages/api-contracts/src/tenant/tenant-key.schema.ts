import { z } from "zod";

/**
 * Mirrors packages/domain's TenantKey.create() validation (section 9.1 of
 * the PR-02 instructions). Kept in sync manually — domain stays
 * framework/Zod-free, api-contracts stays Prisma-free, so this is the one
 * place the format is intentionally duplicated.
 */
export const tenantKeySchema = z
  .string()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{1,48})[a-z0-9]$/,
    "Tenant key must be 3-50 lowercase alphanumeric characters or hyphens, with no leading or trailing hyphen",
  );
