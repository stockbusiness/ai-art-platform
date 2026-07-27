import { randomUUID } from "node:crypto";

import { createPrismaClient, type PrismaClient } from "@ai-art-platform/database";
import { ServiceUnavailableException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ReadyController } from "../../src/health/ready.controller.js";
import type { PrismaService } from "../../src/infrastructure/database/prisma.service.js";

function readyControllerFor(databaseUrl: string): ReadyController {
  const service = { client: createPrismaClient({ databaseUrl }) } as PrismaService;
  return new ReadyController(service);
}

const baseUrl = process.env["DATABASE_URL"];
if (!baseUrl) {
  throw new Error("DATABASE_URL must be set by the integration test global setup");
}

describe("GET /ready — failure paths (section 13.3 / 16.3)", () => {
  it("returns 503 when the database is unreachable", async () => {
    const unreachableUrl = "postgresql://aiart:aiart_local@localhost:1/does-not-matter";
    const controller = readyControllerFor(unreachableUrl);

    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  describe("with a schema that has no applied migrations", () => {
    const schemaName = `no_migrations_${randomUUID().replace(/-/g, "")}`;
    const adminClient: PrismaClient = createPrismaClient({ databaseUrl: baseUrl });
    let schemaUrl: string;

    beforeAll(async () => {
      await adminClient.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
      const url = new URL(baseUrl);
      url.searchParams.set("schema", schemaName);
      schemaUrl = url.toString();
    });

    afterAll(async () => {
      await adminClient.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await adminClient.$disconnect();
    });

    it("returns 503 because _prisma_migrations does not exist in that schema", async () => {
      const controller = readyControllerFor(schemaUrl);

      await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
