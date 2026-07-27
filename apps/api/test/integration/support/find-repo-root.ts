import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Same walk-up strategy as packages/config's loadDotEnv, duplicated here to avoid a test-only dependency on packages/config internals. */
export function findRepoRoot(fromUrl: string): string {
  let dir = dirname(fileURLToPath(fromUrl));
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error("Could not locate the monorepo root (pnpm-workspace.yaml) from " + fromUrl);
}
