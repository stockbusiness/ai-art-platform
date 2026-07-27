import { describe, expect, it } from "vitest";

import { err, isErr, isOk, mapResult, ok } from "./result.js";

describe("Result", () => {
  it("creates a success result", () => {
    const result = ok(42);
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
  });

  it("creates a failure result", () => {
    const result = err("failed");
    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
  });

  it("maps only success values", () => {
    const success = mapResult(ok(2), (value) => value * 2);
    expect(isOk(success) && success.value).toBe(4);

    const failureInput: ReturnType<typeof err<string>> = err("nope");
    const failure = mapResult(failureInput, (value: number) => value * 2);
    expect(isErr(failure) && failure.error).toBe("nope");
  });
});
