import { describe, expect, it } from "vitest";

import { DomainError } from "./domain-error.js";

class SampleNotFoundError extends DomainError {
  readonly code = "SAMPLE_NOT_FOUND";
}

describe("DomainError", () => {
  it("carries a stable error code and readable name", () => {
    const error = new SampleNotFoundError("sample was not found");
    expect(error.code).toBe("SAMPLE_NOT_FOUND");
    expect(error.name).toBe("SampleNotFoundError");
    expect(error).toBeInstanceOf(Error);
  });
});
