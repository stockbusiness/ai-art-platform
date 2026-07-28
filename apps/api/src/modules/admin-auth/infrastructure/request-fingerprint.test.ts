import { describe, expect, it } from "vitest";

import { hashWithSecret } from "./request-fingerprint.js";

describe("hashWithSecret", () => {
  it("produces a 64-character hex digest (HMAC-SHA256)", () => {
    expect(hashWithSecret("203.0.113.1", "secret")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same value and secret", () => {
    expect(hashWithSecret("203.0.113.1", "secret")).toBe(hashWithSecret("203.0.113.1", "secret"));
  });

  it("produces a different hash for a different secret (unrecoverable without it)", () => {
    expect(hashWithSecret("203.0.113.1", "secret-a")).not.toBe(
      hashWithSecret("203.0.113.1", "secret-b"),
    );
  });

  it("produces a different hash for a different value", () => {
    expect(hashWithSecret("203.0.113.1", "secret")).not.toBe(
      hashWithSecret("203.0.113.2", "secret"),
    );
  });

  it("never contains the plaintext input", () => {
    expect(hashWithSecret("admin@example.com", "secret")).not.toContain("admin@example.com");
  });
});
