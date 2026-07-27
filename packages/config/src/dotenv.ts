import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_ANCESTOR_LOOKUPS = 10;

/**
 * Walks up from `startDir` looking for `pnpm-workspace.yaml`, which only
 * exists at the monorepo root. Apps are launched with different working
 * directories depending on how they're invoked (turbo, `pnpm --filter`,
 * a plain `node dist/main.js`), so `process.cwd()` can't be trusted to
 * always be the repo root.
 */
function findRepoRoot(startDir: string): string | undefined {
  let dir = startDir;
  for (let i = 0; i < MAX_ANCESTOR_LOOKUPS; i += 1) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
  return undefined;
}

/**
 * Loads the repo-root `.env` file into `process.env`, if one exists.
 * Every app must still boot with working defaults when `.env` is absent
 * (see README.md), so a missing file is not an error.
 *
 * @param fromUrl `import.meta.url` of the calling module — used to locate
 *   the repo root regardless of the process's current working directory.
 */
export function loadDotEnv(fromUrl: string): void {
  const startDir = dirname(fileURLToPath(fromUrl));
  const root = findRepoRoot(startDir);
  if (!root) {
    return;
  }
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) {
    return;
  }
  process.loadEnvFile(envPath);
}
