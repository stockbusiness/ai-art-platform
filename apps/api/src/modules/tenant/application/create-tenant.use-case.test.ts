import { TenantKeyAlreadyExistsError } from "@ai-art-platform/domain";
import { describe, expect, it } from "vitest";

import { CreateTenantUseCase } from "./create-tenant.use-case.js";
import { InMemoryTenantRepository } from "./test-fixtures/in-memory-tenant.repository.js";

describe("CreateTenantUseCase", () => {
  it("creates a new ACTIVE tenant", async () => {
    const useCase = new CreateTenantUseCase(new InMemoryTenantRepository());

    const tenant = await useCase.execute({ tenantKeyRaw: "default", name: "AIアート教室" });

    expect(tenant.status).toBe("ACTIVE");
    expect(tenant.tenantKey.toString()).toBe("default");
    expect(tenant.name).toBe("AIアート教室");
  });

  it("rejects a duplicate tenantKey", async () => {
    const repository = new InMemoryTenantRepository();
    const useCase = new CreateTenantUseCase(repository);
    await useCase.execute({ tenantKeyRaw: "default", name: "First" });

    await expect(
      useCase.execute({ tenantKeyRaw: "default", name: "Second" }),
    ).rejects.toBeInstanceOf(TenantKeyAlreadyExistsError);
  });

  it("rejects an invalid tenantKey format before touching the repository", async () => {
    const useCase = new CreateTenantUseCase(new InMemoryTenantRepository());

    await expect(useCase.execute({ tenantKeyRaw: "Bad Key", name: "x" })).rejects.toThrow();
  });
});
