import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { findRepoRoot } from "./support/find-repo-root.js";
import { provisionTestDatabase } from "./support/test-database.js";

export default async function globalSetup(): Promise<() => Promise<void>> {
  const { databaseUrl, teardown } = await provisionTestDatabase();

  process.env["DATABASE_URL"] = databaseUrl;
  process.env["DATABASE_DIRECT_URL"] = databaseUrl;
  // PR-03A's ApiConfigModule factory (apps/api/src/infrastructure/config/
  // api-config.module.ts) validates these via apiEnvSchema at Nest DI
  // container construction time — every integration test that boots
  // AppModule (via createTestApp()) needs them present, not just the ones
  // that exercise admin-auth directly. Deterministic test-only values,
  // never used outside this process.
  process.env["ADMIN_WEB_ORIGIN"] ??= "http://localhost:5173";
  process.env["AUTH_IP_HASH_SECRET"] ??= "integration-test-only-secret-not-for-real-use";

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
