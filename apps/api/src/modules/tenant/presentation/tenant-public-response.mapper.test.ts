import { Tenant, TenantKey } from "@ai-art-platform/domain";
import { describe, expect, it } from "vitest";

import { toTenantPublicResponse } from "./tenant-public-response.mapper.js";

function aTenant(): Tenant {
  const tenantKeyResult = TenantKey.create("default");
  if (!tenantKeyResult.ok) {
    throw tenantKeyResult.error;
  }
  return Tenant.create({
    id: "11111111-1111-1111-1111-111111111111",
    tenantKey: tenantKeyResult.value,
    name: "AIアート教室",
    now: new Date(),
  });
}

describe("toTenantPublicResponse", () => {
  it("excludes the internal UUID", () => {
    const response = toTenantPublicResponse(aTenant());

    expect(JSON.stringify(response)).not.toContain("11111111-1111-1111-1111-111111111111");
    expect("id" in response.data).toBe(false);
  });

  it("includes only tenantKey, name, timezone, and defaultLocale", () => {
    const response = toTenantPublicResponse(aTenant());

    expect(Object.keys(response.data).sort()).toEqual([
      "defaultLocale",
      "name",
      "tenantKey",
      "timezone",
    ]);
  });
});
