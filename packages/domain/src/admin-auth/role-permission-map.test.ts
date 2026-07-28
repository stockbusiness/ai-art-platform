import { describe, expect, it } from "vitest";

import { ADMIN_ROLES } from "./admin-role.js";
import { PERMISSIONS } from "./permission.js";
import { ROLE_PERMISSIONS, roleHasPermission } from "./role-permission-map.js";

describe("ROLE_PERMISSIONS", () => {
  it("covers every AdminRole", () => {
    for (const role of ADMIN_ROLES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });

  it("grants SUPER_ADMIN every permission", () => {
    for (const permission of PERMISSIONS) {
      expect(roleHasPermission("SUPER_ADMIN", permission)).toBe(true);
    }
  });

  it("grants every role admin:self:read and tenant:read", () => {
    for (const role of ADMIN_ROLES) {
      expect(roleHasPermission(role, "admin:self:read")).toBe(true);
      expect(roleHasPermission(role, "tenant:read")).toBe(true);
    }
  });

  it("only SUPER_ADMIN and TENANT_OWNER have admin:manage", () => {
    expect(roleHasPermission("SUPER_ADMIN", "admin:manage")).toBe(true);
    expect(roleHasPermission("TENANT_OWNER", "admin:manage")).toBe(true);
    expect(roleHasPermission("TENANT_ADMIN", "admin:manage")).toBe(false);
    expect(roleHasPermission("STAFF", "admin:manage")).toBe(false);
    expect(roleHasPermission("VIEWER", "admin:manage")).toBe(false);
  });

  it("VIEWER has no write permission", () => {
    expect(roleHasPermission("VIEWER", "operations:write")).toBe(false);
    expect(roleHasPermission("VIEWER", "tenant:update")).toBe(false);
  });

  it("STAFF can write operations but not manage tenant/admin settings", () => {
    expect(roleHasPermission("STAFF", "operations:write")).toBe(true);
    expect(roleHasPermission("STAFF", "tenant:update")).toBe(false);
    expect(roleHasPermission("STAFF", "admin:read")).toBe(false);
  });

  it("TENANT_ADMIN can read audit but not manage admins", () => {
    expect(roleHasPermission("TENANT_ADMIN", "audit:read")).toBe(true);
    expect(roleHasPermission("TENANT_ADMIN", "admin:manage")).toBe(false);
  });
});
