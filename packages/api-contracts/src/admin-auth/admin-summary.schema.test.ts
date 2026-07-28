import { describe, expect, it } from "vitest";

import { adminSummarySchema } from "./admin-summary.schema.js";

describe("adminSummarySchema", () => {
  it("accepts a Tenant-scoped admin summary", () => {
    const result = adminSummarySchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      tenantId: "22222222-2222-2222-2222-222222222222",
      tenantKey: "default",
      email: "admin@example.com",
      name: "Admin",
      role: "TENANT_OWNER",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a SUPER_ADMIN summary with null tenantId/tenantKey", () => {
    const result = adminSummarySchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      tenantId: null,
      tenantKey: null,
      email: "root@example.com",
      name: "Root",
      role: "SUPER_ADMIN",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown role", () => {
    const result = adminSummarySchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      tenantId: null,
      tenantKey: null,
      email: "root@example.com",
      name: "Root",
      role: "NOT_A_ROLE",
    });
    expect(result.success).toBe(false);
  });

  it("strips a passwordHash field if present, rather than surfacing it", () => {
    const result = adminSummarySchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      tenantId: null,
      tenantKey: null,
      email: "root@example.com",
      name: "Root",
      role: "SUPER_ADMIN",
      passwordHash: "should-not-survive",
    });
    expect(result.success).toBe(true);
    expect(result.success && "passwordHash" in result.data).toBe(false);
  });
});
