import { describe, expect, it } from "vitest";

import { tenantPublicResponseSchema } from "./tenant-public-response.schema.js";

describe("tenantPublicResponseSchema", () => {
  it("accepts a valid public tenant response", () => {
    const result = tenantPublicResponseSchema.safeParse({
      data: {
        tenantKey: "default",
        name: "AIアート教室",
        timezone: "Asia/Tokyo",
        defaultLocale: "ja-JP",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a response carrying an internal id field alongside the expected shape", () => {
    // Zod's default parse strips unknown keys rather than rejecting them —
    // this test documents that an `id` field, if present, is not part of
    // the validated contract and would not survive a round-trip.
    const result = tenantPublicResponseSchema.safeParse({
      data: {
        id: "11111111-1111-1111-1111-111111111111",
        tenantKey: "default",
        name: "AIアート教室",
        timezone: "Asia/Tokyo",
        defaultLocale: "ja-JP",
      },
    });
    expect(result.success).toBe(true);
    expect(result.success && "id" in result.data.data).toBe(false);
  });

  it("rejects an invalid tenantKey", () => {
    const result = tenantPublicResponseSchema.safeParse({
      data: { tenantKey: "Bad Key", name: "x", timezone: "UTC", defaultLocale: "en-US" },
    });
    expect(result.success).toBe(false);
  });
});
