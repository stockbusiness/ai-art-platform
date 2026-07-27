import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { findRepoRoot } from "./support/find-repo-root.js";
import { provisionTestDatabase } from "./support/test-database.js";

export default async function globalSetup(): Promise<() => Promise<void>> {
  const { databaseUrl, teardown } = await provisionTestDatabase();

  process.env["DATABASE_URL"] = databaseUrl;
  process.env["DATABASE_DIRECT_URL"] = databaseUrl;

  const repoRoot = findRepoRoot(import.meta.url);
  const schemaPath = resolve(repoRoot, "prisma", "schema.prisma");

  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy", "--schema", schemaPath], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });

  return async () => {
    await teardown();
  };
}
