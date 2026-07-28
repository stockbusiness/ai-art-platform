import { describe, expect, it } from "vitest";

import { adminLoginRequestSchema } from "./admin-login-request.schema.js";

describe("adminLoginRequestSchema", () => {
  it("accepts a Tenant admin login request", () => {
    const result = adminLoginRequestSchema.safeParse({
      tenantKey: "default",
      email: "admin@example.com",
      password: "correct-horse-battery",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a SUPER_ADMIN login request without tenantKey", () => {
    const result = adminLoginRequestSchema.safeParse({
      email: "root@example.com",
      password: "correct-horse-battery",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing email", () => {
    const result = adminLoginRequestSchema.safeParse({ password: "correct-horse-battery" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing password", () => {
    const result = adminLoginRequestSchema.safeParse({ email: "admin@example.com" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed tenantKey", () => {
    const result = adminLoginRequestSchema.safeParse({
      tenantKey: "Bad Key",
      email: "admin@example.com",
      password: "correct-horse-battery",
    });
    expect(result.success).toBe(false);
  });
});
