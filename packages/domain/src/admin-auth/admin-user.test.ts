import { describe, expect, it } from "vitest";

import { AdminRoleTenantMismatchError } from "./admin-auth-errors.js";
import { AdminEmail } from "./admin-email.js";
import { AdminName } from "./admin-name.js";
import { AdminUser } from "./admin-user.js";

function anEmail(raw = "admin@example.com"): AdminEmail {
  const result = AdminEmail.create(raw);
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}

function aName(raw = "Admin"): AdminName {
  const result = AdminName.create(raw);
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}

describe("AdminUser", () => {
  it("creates a SUPER_ADMIN with tenantId null", () => {
    const admin = AdminUser.create({
      id: "a1",
      tenantId: null,
      email: anEmail(),
      passwordHash: "hash",
      name: aName(),
      role: "SUPER_ADMIN",
      now: new Date(),
    });
    expect(admin.tenantId).toBeNull();
    expect(admin.status).toBe("ACTIVE");
    expect(admin.failedLoginCount).toBe(0);
  });

  it("creates a TENANT_OWNER with a tenantId", () => {
    const admin = AdminUser.create({
      id: "a1",
      tenantId: "t1",
      email: anEmail(),
      passwordHash: "hash",
      name: aName(),
      role: "TENANT_OWNER",
      now: new Date(),
    });
    expect(admin.tenantId).toBe("t1");
  });

  it("rejects SUPER_ADMIN with a non-null tenantId", () => {
    expect(() =>
      AdminUser.create({
        id: "a1",
        tenantId: "t1",
        email: anEmail(),
        passwordHash: "hash",
        name: aName(),
        role: "SUPER_ADMIN",
        now: new Date(),
      }),
    ).toThrow(AdminRoleTenantMismatchError);
  });

  it.each(["TENANT_OWNER", "TENANT_ADMIN", "STAFF", "VIEWER"] as const)(
    "rejects %s with a null tenantId",
    (role) => {
      expect(() =>
        AdminUser.create({
          id: "a1",
          tenantId: null,
          email: anEmail(),
          passwordHash: "hash",
          name: aName(),
          role,
          now: new Date(),
        }),
      ).toThrow(AdminRoleTenantMismatchError);
    },
  );

  it("hasPermission delegates to the Permission Matrix", () => {
    const admin = AdminUser.create({
      id: "a1",
      tenantId: "t1",
      email: anEmail(),
      passwordHash: "hash",
      name: aName(),
      role: "VIEWER",
      now: new Date(),
    });
    expect(admin.hasPermission("tenant:read")).toBe(true);
    expect(admin.hasPermission("operations:write")).toBe(false);
  });

  describe("lockout", () => {
    function newAdmin(): AdminUser {
      return AdminUser.create({
        id: "a1",
        tenantId: "t1",
        email: anEmail(),
        passwordHash: "hash",
        name: aName(),
        role: "STAFF",
        now: new Date("2026-01-01T00:00:00Z"),
      });
    }

    it("is not locked before reaching the failure threshold", () => {
      const admin = newAdmin();
      const now = new Date("2026-01-01T00:00:00Z");
      admin.recordFailedLogin(now, 5, 900);
      admin.recordFailedLogin(now, 5, 900);
      admin.recordFailedLogin(now, 5, 900);
      admin.recordFailedLogin(now, 5, 900);
      expect(admin.failedLoginCount).toBe(4);
      expect(admin.isLocked(now)).toBe(false);
    });

    it("locks the account once the failure threshold is reached", () => {
      const admin = newAdmin();
      const now = new Date("2026-01-01T00:00:00Z");
      for (let i = 0; i < 5; i += 1) {
        admin.recordFailedLogin(now, 5, 900);
      }
      expect(admin.failedLoginCount).toBe(5);
      expect(admin.isLocked(now)).toBe(true);
    });

    it("is no longer locked once the lockout window has elapsed", () => {
      const admin = newAdmin();
      const now = new Date("2026-01-01T00:00:00Z");
      for (let i = 0; i < 5; i += 1) {
        admin.recordFailedLogin(now, 5, 900);
      }
      const after = new Date(now.getTime() + 900 * 1000 + 1);
      expect(admin.isLocked(after)).toBe(false);
    });

    it("resets the failure counter and lock on a successful login", () => {
      const admin = newAdmin();
      const now = new Date("2026-01-01T00:00:00Z");
      for (let i = 0; i < 5; i += 1) {
        admin.recordFailedLogin(now, 5, 900);
      }
      expect(admin.isLocked(now)).toBe(true);

      admin.recordSuccessfulLogin(now);

      expect(admin.failedLoginCount).toBe(0);
      expect(admin.isLocked(now)).toBe(false);
      expect(admin.lastLoginAt).toEqual(now);
    });
  });
});
