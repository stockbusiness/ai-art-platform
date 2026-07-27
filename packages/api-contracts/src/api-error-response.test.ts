import { describe, expect, it } from "vitest";

import { apiErrorResponseSchema } from "./api-error-response.js";

describe("apiErrorResponseSchema", () => {
  it("accepts a minimal valid error response", () => {
    const result = apiErrorResponseSchema.safeParse({
      error: { code: "VALIDATION_ERROR", message: "Invalid input", requestId: "req-1" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional correlationId and details", () => {
    const result = apiErrorResponseSchema.safeParse({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        requestId: "req-1",
        correlationId: "corr-1",
        details: { field: "email" },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a response missing required fields", () => {
    const result = apiErrorResponseSchema.safeParse({ error: { code: "X" } });
    expect(result.success).toBe(false);
  });
});
