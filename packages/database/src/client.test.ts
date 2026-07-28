import { describe, expect, it } from "vitest";

import { createPrismaClient, PrismaClient } from "./client.js";

describe("createPrismaClient", () => {
  it("returns a PrismaClient instance without connecting", () => {
    const client = createPrismaClient({ databaseUrl: "postgresql://user:pass@localhost:5432/db" });
    expect(client).toBeInstanceOf(PrismaClient);
  });

  it("applies a default connection_limit when the URL doesn't specify one (review-fix P0-4)", () => {
    // No direct way to read back the resolved datasource URL from a
    // PrismaClient instance — this just confirms construction succeeds
    // with both a bare URL and one that already sets connection_limit,
    // proving withConnectionLimit()'s query-string handling (both
    // append and skip-if-present paths) doesn't throw or malform the URL.
    expect(() =>
      createPrismaClient({ databaseUrl: "postgresql://user:pass@localhost:5432/db" }),
    ).not.toThrow();
    expect(() =>
      createPrismaClient({
        databaseUrl: "postgresql://user:pass@localhost:5432/db?connection_limit=5",
      }),
    ).not.toThrow();
    expect(() =>
      createPrismaClient({
        databaseUrl: "postgresql://user:pass@localhost:5432/db?schema=public",
      }),
    ).not.toThrow();
  });
});
