import { TenantNotFoundError } from "@ai-art-platform/domain";
import { describe, expect, it } from "vitest";

import { CreateTenantUseCase } from "./create-tenant.use-case.js";
import { InMemoryTenantRepository } from "./test-fixtures/in-memory-tenant.repository.js";
import { UpdateTenantUseCase } from "./update-tenant.use-case.js";

describe("UpdateTenantUseCase", () => {
  it("transitions ACTIVE -> SUSPENDED", async () => {
    const repository = new InMemoryTenantRepository();
    const created = await new CreateTenantUseCase(repository).execute({
      tenantKeyRaw: "default",
      name: "AIアート教室",
    });

    const updated = await new UpdateTenantUseCase(repository).execute({
      id: created.id,
      status: "SUSPENDED",
    });

    expect(updated.status).toBe("SUSPENDED");
  });

  it("renames a tenant", async () => {
    const repository = new InMemoryTenantRepository();
    const created = await new CreateTenantUseCase(repository).execute({
      tenantKeyRaw: "default",
      name: "Old Name",
    });

    const updated = await new UpdateTenantUseCase(repository).execute({
      id: created.id,
      name: "New Name",
    });

    expect(updated.name).toBe("New Name");
  });

  it("throws TenantNotFoundError for an unknown id", async () => {
    const useCase = new UpdateTenantUseCase(new InMemoryTenantRepository());

    await expect(useCase.execute({ id: "missing", name: "x" })).rejects.toBeInstanceOf(
      TenantNotFoundError,
    );
  });
});
