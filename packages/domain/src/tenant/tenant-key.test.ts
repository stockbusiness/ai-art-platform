import { describe, expect, it } from "vitest";

import { isErr, isOk } from "../result.js";

import { InvalidTenantKeyError, TenantKey } from "./tenant-key.js";

describe("TenantKey", () => {
  it("accepts a valid tenant key", () => {
    const result = TenantKey.create("default");
    expect(isOk(result)).toBe(true);
    expect(isOk(result) && result.value.toString()).toBe("default");
  });

  it("accepts the minimum length (3 chars)", () => {
    expect(isOk(TenantKey.create("abc"))).toBe(true);
  });

  it("accepts hyphens in the middle", () => {
    expect(isOk(TenantKey.create("tenant-a1"))).toBe(true);
  });

  it("rejects a key shorter than 3 characters", () => {
    const result = TenantKey.create("ab");
    expect(isErr(result)).toBe(true);
    expect(isErr(result) && result.error).toBeInstanceOf(InvalidTenantKeyError);
  });

  it("rejects a key longer than 50 characters", () => {
    const tooLong = "a".repeat(51);
    expect(isErr(TenantKey.create(tooLong))).toBe(true);
  });

  it("rejects uppercase characters", () => {
    expect(isErr(TenantKey.create("Default"))).toBe(true);
  });

  it("rejects a leading hyphen", () => {
    expect(isErr(TenantKey.create("-default"))).toBe(true);
  });

  it("rejects a trailing hyphen", () => {
    expect(isErr(TenantKey.create("default-"))).toBe(true);
  });

  it("compares two keys by value", () => {
    const a = TenantKey.create("default");
    const b = TenantKey.create("default");
    expect(isOk(a) && isOk(b) && a.value.equals(b.value)).toBe(true);
  });
});
