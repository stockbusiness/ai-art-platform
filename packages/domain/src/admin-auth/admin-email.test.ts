import { describe, expect, it } from "vitest";

import { InvalidAdminEmailError } from "./admin-auth-errors.js";
import { AdminEmail } from "./admin-email.js";

describe("AdminEmail", () => {
  it("accepts a valid email", () => {
    const result = AdminEmail.create("admin@example.com");
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.toString()).toBe("admin@example.com");
  });

  it("normalizes to lowercase", () => {
    const result = AdminEmail.create("Admin@Example.COM");
    expect(result.ok && result.value.toString()).toBe("admin@example.com");
  });

  it("trims surrounding whitespace", () => {
    const result = AdminEmail.create("  admin@example.com  ");
    expect(result.ok && result.value.toString()).toBe("admin@example.com");
  });

  it("treats emails differing only by case/whitespace as equal", () => {
    const a = AdminEmail.create(" Admin@Example.com");
    const b = AdminEmail.create("admin@EXAMPLE.com ");
    expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
  });

  it("rejects an empty string", () => {
    const result = AdminEmail.create("");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBeInstanceOf(InvalidAdminEmailError);
  });

  it("rejects a whitespace-only string", () => {
    expect(AdminEmail.create("   ").ok).toBe(false);
  });

  it("rejects a string with no @", () => {
    expect(AdminEmail.create("not-an-email").ok).toBe(false);
  });

  it("rejects a string with no domain", () => {
    expect(AdminEmail.create("admin@").ok).toBe(false);
  });

  it("rejects a string with no TLD", () => {
    expect(AdminEmail.create("admin@localhost").ok).toBe(false);
  });

  it("rejects an email over 254 characters", () => {
    const longLocal = "a".repeat(250);
    expect(AdminEmail.create(`${longLocal}@example.com`).ok).toBe(false);
  });
});
