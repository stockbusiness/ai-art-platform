import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function readOwnPackageJson(): PackageJsonShape {
  const url = new URL("../package.json", import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), "utf-8")) as PackageJsonShape;
}

/**
 * PR-02 adds Prisma to the monorepo; this guards the PR-01 rule (section
 * 7.2: "packages/domain は Prisma、NestJS、React、Zod へ依存させない") by
 * asserting it structurally rather than trusting nobody adds it later.
 */
describe("packages/domain framework independence", () => {
  it("declares no runtime dependency on Prisma, NestJS, React, or Zod", () => {
    const packageJson = readOwnPackageJson();
    const declaredDeps = {
      ...packageJson.dependencies,
      ...packageJson.peerDependencies,
    };
    const forbidden = [
      "@prisma/client",
      "prisma",
      "@nestjs/common",
      "@nestjs/core",
      "react",
      "zod",
    ];

    for (const name of forbidden) {
      expect(declaredDeps).not.toHaveProperty(name);
    }
  });
});
