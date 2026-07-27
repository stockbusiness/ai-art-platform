import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// Separate from vitest.config.ts (unit tests) so `pnpm test` never
// accidentally requires a database. Run with `pnpm test:integration`
// after `pnpm db:generate` (see section 16 of the PR-02 instructions).
//
// Uses the SWC transform (not Vitest's default esbuild) because these
// tests bootstrap a real NestJS app via @nestjs/testing, which relies on
// `emitDecoratorMetadata` for constructor injection — esbuild does not
// emit it correctly (the same issue documented for `tsx` in
// OPEN_QUESTIONS_PR01.md item 8, now hit by Vitest's own transform too).
export default defineConfig({
  plugins: [swc.vite()],
  test: {
    environment: "node",
    include: ["test/integration/**/*.integration.spec.ts"],
    globalSetup: ["test/integration/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
