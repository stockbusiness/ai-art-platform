import { describe, expect, it } from "vitest";

import { createPrismaClient, PrismaClient } from "./client.js";

describe("createPrismaClient", () => {
  it("returns a PrismaClient instance without connecting", () => {
    const client = createPrismaClient({ databaseUrl: "postgresql://user:pass@localhost:5432/db" });
    expect(client).toBeInstanceOf(PrismaClient);
  });
});
