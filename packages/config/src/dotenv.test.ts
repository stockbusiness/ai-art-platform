import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { loadDotEnv } from "./dotenv.js";

describe("loadDotEnv", () => {
  let tempDir: string | undefined;

  afterEach(() => {
    delete process.env["DOTENV_TEST_VALUE"];
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it("loads the repo-root .env when found by walking up from the caller", () => {
    tempDir = mkdtempSync(join(tmpdir(), "dotenv-test-"));
    writeFileSync(join(tempDir, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
    writeFileSync(join(tempDir, ".env"), "DOTENV_TEST_VALUE=from-dotenv\n");

    const nestedFile = join(tempDir, "apps", "api", "src", "main.ts");
    loadDotEnv(pathToFileURL(nestedFile).href);

    expect(process.env["DOTENV_TEST_VALUE"]).toBe("from-dotenv");
  });

  it("does nothing when no repo root or .env is found", () => {
    tempDir = mkdtempSync(join(tmpdir(), "dotenv-test-"));
    const nestedFile = join(tempDir, "src", "main.ts");

    expect(() => loadDotEnv(pathToFileURL(nestedFile).href)).not.toThrow();
    expect(process.env["DOTENV_TEST_VALUE"]).toBeUndefined();
  });
});
