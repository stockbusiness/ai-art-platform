import { describe, expect, it } from "vitest";

import { tenantKeySchema } from "./tenant-key.schema.js";

describe("tenantKeySchema", () => {
  it("accepts a valid key", () => {
    expect(tenantKeySchema.safeParse("default").success).toBe(true);
  });

  it("rejects an uppercase key", () => {
    expect(tenantKeySchema.safeParse("Default").success).toBe(false);
  });

  it("rejects a key shorter than 3 characters", () => {
    expect(tenantKeySchema.safeParse("ab").success).toBe(false);
  });

  it("rejects a leading hyphen", () => {
    expect(tenantKeySchema.safeParse("-default").success).toBe(false);
  });
});
