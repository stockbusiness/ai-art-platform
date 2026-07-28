import { describe, expect, it } from "vitest";

import { timingSafeStringEqual } from "./timing-safe-equal.js";

describe("timingSafeStringEqual", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeStringEqual("abc123", "abc123")).toBe(true);
  });

  it("returns false for a single differing character", () => {
    expect(timingSafeStringEqual("abc123", "abc124")).toBe(false);
  });

  it("returns false when lengths differ, without throwing", () => {
    expect(() => timingSafeStringEqual("abc123", "abc1234")).not.toThrow();
    expect(timingSafeStringEqual("abc123", "abc1234")).toBe(false);
  });

  it("returns true for two empty strings", () => {
    expect(timingSafeStringEqual("", "")).toBe(true);
  });

  it("returns false when only one side is empty", () => {
    expect(timingSafeStringEqual("", "abc123")).toBe(false);
    expect(timingSafeStringEqual("abc123", "")).toBe(false);
  });
});
