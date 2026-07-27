import { describe, expect, it } from "vitest";

import { TenantStatusTransitionError } from "./tenant-errors.js";
import { TenantKey } from "./tenant-key.js";
import { Tenant } from "./tenant.js";

function aTenantKey(raw = "default"): TenantKey {
  const result = TenantKey.create(raw);
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}

describe("Tenant", () => {
  it("creates a new tenant as ACTIVE with default timezone/locale", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const tenant = Tenant.create({ id: "t1", tenantKey: aTenantKey(), name: "AIアート教室", now });

    expect(tenant.status).toBe("ACTIVE");
    expect(tenant.timezone).toBe("Asia/Tokyo");
    expect(tenant.defaultLocale).toBe("ja-JP");
    expect(tenant.createdAt).toEqual(now);
    expect(tenant.updatedAt).toEqual(now);
    expect(tenant.isActive()).toBe(true);
  });

  it("honors explicit timezone/locale overrides", () => {
    const tenant = Tenant.create({
      id: "t1",
      tenantKey: aTenantKey(),
      name: "Test",
      timezone: "UTC",
      defaultLocale: "en-US",
      now: new Date(),
    });

    expect(tenant.timezone).toBe("UTC");
    expect(tenant.defaultLocale).toBe("en-US");
  });

  it("allows ACTIVE -> SUSPENDED", () => {
    const tenant = Tenant.create({
      id: "t1",
      tenantKey: aTenantKey(),
      name: "Test",
      now: new Date(),
    });
    const later = new Date(tenant.updatedAt.getTime() + 1000);

    tenant.changeStatus("SUSPENDED", later);

    expect(tenant.status).toBe("SUSPENDED");
    expect(tenant.updatedAt).toEqual(later);
  });

  it("allows SUSPENDED -> ACTIVE", () => {
    const tenant = Tenant.create({
      id: "t1",
      tenantKey: aTenantKey(),
      name: "Test",
      now: new Date(),
    });
    tenant.changeStatus("SUSPENDED", new Date());

    tenant.changeStatus("ACTIVE", new Date());

    expect(tenant.status).toBe("ACTIVE");
  });

  it("rejects a no-op transition to the same status", () => {
    const tenant = Tenant.create({
      id: "t1",
      tenantKey: aTenantKey(),
      name: "Test",
      now: new Date(),
    });

    expect(() => tenant.changeStatus("ACTIVE", new Date())).toThrow(TenantStatusTransitionError);
  });

  it("updates the name and updatedAt on rename", () => {
    const tenant = Tenant.create({
      id: "t1",
      tenantKey: aTenantKey(),
      name: "Old",
      now: new Date(0),
    });
    const later = new Date(1000);

    tenant.rename("New", later);

    expect(tenant.name).toBe("New");
    expect(tenant.updatedAt).toEqual(later);
  });

  it("reconstitutes from persisted props without validating business rules", () => {
    const props = {
      id: "t1",
      tenantKey: aTenantKey(),
      name: "Test",
      status: "SUSPENDED" as const,
      timezone: "Asia/Tokyo",
      defaultLocale: "ja-JP",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };

    const tenant = Tenant.reconstitute(props);

    expect(tenant.id).toBe("t1");
    expect(tenant.status).toBe("SUSPENDED");
  });
});
