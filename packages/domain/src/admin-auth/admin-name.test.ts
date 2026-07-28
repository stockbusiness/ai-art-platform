import { describe, expect, it } from "vitest";

import { InvalidAdminNameError } from "./admin-auth-errors.js";
import { AdminName } from "./admin-name.js";

describe("AdminName", () => {
  it("accepts a valid name", () => {
    const result = AdminName.create("Admin Taro");
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.toString()).toBe("Admin Taro");
  });

  it("rejects an empty string", () => {
    const result = AdminName.create("");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBeInstanceOf(InvalidAdminNameError);
  });

  it("rejects a whitespace-only string", () => {
    expect(AdminName.create("   ").ok).toBe(false);
  });

  it("rejects a name over 120 characters", () => {
    expect(AdminName.create("a".repeat(121)).ok).toBe(false);
  });

  it("accepts a name at exactly the 120-character limit", () => {
    const result = AdminName.create("a".repeat(120));
    expect(result.ok).toBe(true);
  });

  it("accepts a single-character name", () => {
    expect(AdminName.create("a").ok).toBe(true);
  });
});
