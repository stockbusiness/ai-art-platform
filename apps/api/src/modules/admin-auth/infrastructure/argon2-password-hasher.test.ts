import { describe, expect, it } from "vitest";

import { Argon2PasswordHasher } from "./argon2-password-hasher.js";

describe("Argon2PasswordHasher", () => {
  it("produces an argon2id hash", async () => {
    const hasher = new Argon2PasswordHasher();
    const hash = await hasher.hash("correct-horse-battery");
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it("verifies a matching password", async () => {
    const hasher = new Argon2PasswordHasher();
    const hash = await hasher.hash("correct-horse-battery");
    expect(await hasher.verify(hash, "correct-horse-battery")).toBe(true);
  });

  it("rejects a non-matching password", async () => {
    const hasher = new Argon2PasswordHasher();
    const hash = await hasher.hash("correct-horse-battery");
    expect(await hasher.verify(hash, "wrong-password")).toBe(false);
  });

  it("never stores the plaintext password in the hash output", async () => {
    const hasher = new Argon2PasswordHasher();
    const hash = await hasher.hash("super-secret-password-123");
    expect(hash).not.toContain("super-secret-password-123");
  });

  it("returns false (not throw) for a malformed hash string", async () => {
    const hasher = new Argon2PasswordHasher();
    await expect(hasher.verify("not-a-real-hash", "anything")).resolves.toBe(false);
  });
});
