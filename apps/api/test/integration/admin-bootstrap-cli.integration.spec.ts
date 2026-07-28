import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { createPrismaClient, type PrismaClient } from "@ai-art-platform/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { findRepoRoot } from "./support/find-repo-root.js";

const execFileAsync = promisify(execFile);

/**
 * Exercises `pnpm admin:bootstrap`'s actual CLI process (not just its
 * exported functions — there aren't any; `prisma/admin-bootstrap.ts` is a
 * self-invoking script by design, section 11) against the real
 * integration-test database, and inspects its captured stdout/stderr
 * directly — the only way to verify review-fix P1-5 ("Bootstrap CLIから
 * Emailを出力しない") for real, rather than trusting the source code.
 */
describe("admin-bootstrap CLI — never prints the email (P1-5)", () => {
  const repoRoot = findRepoRoot(import.meta.url);
  const testEmail = "bootstrap-cli-test-root@example.com";
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createPrismaClient({ databaseUrl: process.env["DATABASE_URL"] });
  });

  afterAll(async () => {
    await prisma.adminUser.deleteMany({ where: { email: testEmail } });
    await prisma.$disconnect();
  });

  function runBootstrapCli(): Promise<{ stdout: string; stderr: string }> {
    return execFileAsync("pnpm", ["exec", "tsx", "prisma/admin-bootstrap.ts"], {
      cwd: repoRoot,
      env: {
        ...process.env,
        BOOTSTRAP_ADMIN_EMAIL: testEmail,
        BOOTSTRAP_ADMIN_PASSWORD: "a-real-password-at-least-12-chars",
        BOOTSTRAP_ADMIN_NAME: "Bootstrap CLI Test Root",
        BOOTSTRAP_ADMIN_ROLE: "SUPER_ADMIN",
      },
    });
  }

  it("first run succeeds and never prints the email in stdout", async () => {
    const { stdout } = await runBootstrapCli();
    expect(stdout).toContain("Bootstrap admin created");
    expect(stdout).not.toContain(testEmail);

    const created = await prisma.adminUser.findFirst({ where: { email: testEmail } });
    expect(created).not.toBeNull();
    expect(stdout).toContain(created?.id ?? "");
  });

  it("second run (duplicate) fails and never prints the email in stdout/stderr", async () => {
    // Depends on the previous test having already created this email once.
    let threw = false;
    try {
      await runBootstrapCli();
    } catch (error: unknown) {
      threw = true;
      const { code, stdout, stderr } = error as { code: number; stdout: string; stderr: string };
      expect(code).toBe(1);
      expect(stdout).not.toContain(testEmail);
      expect(stderr).not.toContain(testEmail);
      expect(stderr).toContain("already exists");
    }
    expect(threw).toBe(true);
  });
}, 30_000);
