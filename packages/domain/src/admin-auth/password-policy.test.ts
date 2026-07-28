import { describe, expect, it } from "vitest";

import { InvalidAdminPasswordError } from "./admin-auth-errors.js";
import { AdminEmail } from "./admin-email.js";
import { validateAdminPassword } from "./password-policy.js";

function anEmail(raw = "admin@example.com"): AdminEmail {
  const result = AdminEmail.create(raw);
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}

describe("validateAdminPassword", () => {
  it("accepts a valid password", () => {
    const result = validateAdminPassword("correct-horse-battery", anEmail());
    expect(result.ok).toBe(true);
  });

  it("rejects a password shorter than 12 characters", () => {
    const result = validateAdminPassword("short11char", anEmail());
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBeInstanceOf(InvalidAdminPasswordError);
  });

  it("accepts a password at exactly 12 characters", () => {
    expect(validateAdminPassword("exactly12chr", anEmail()).ok).toBe(true);
  });

  it("rejects a password longer than 128 characters", () => {
    const result = validateAdminPassword("a".repeat(129), anEmail());
    expect(result.ok).toBe(false);
  });

  it("accepts a password at exactly 128 characters", () => {
    expect(validateAdminPassword("a".repeat(128), anEmail()).ok).toBe(true);
  });

  it("rejects a whitespace-only password", () => {
    const result = validateAdminPassword(" ".repeat(15), anEmail());
    expect(result.ok).toBe(false);
  });

  it("rejects a password identical to the admin email", () => {
    const email = anEmail("admin@example.com");
    const result = validateAdminPassword("admin@example.com", email);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBeInstanceOf(InvalidAdminPasswordError);
  });

  it("does not trim the password before validating", () => {
    // 10 real characters padded with 2 leading spaces = 12 chars total,
    // but must not be silently trimmed down to 10 and rejected.
    const result = validateAdminPassword("  1234567890", anEmail());
    expect(result.ok).toBe(true);
  });
});
