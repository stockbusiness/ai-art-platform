import { TenantNotFoundError, TenantSuspendedError } from "@ai-art-platform/domain";
import { describe, expect, it } from "vitest";

import { CreateTenantUseCase } from "./create-tenant.use-case.js";
import { ResolvePublicTenantByKeyUseCase } from "./resolve-public-tenant-by-key.use-case.js";
import { InMemoryTenantRepository } from "./test-fixtures/in-memory-tenant.repository.js";
import { UpdateTenantUseCase } from "./update-tenant.use-case.js";

describe("ResolvePublicTenantByKeyUseCase", () => {
  it("resolves an ACTIVE tenant by key", async () => {
    const repository = new InMemoryTenantRepository();
    const create = new CreateTenantUseCase(repository);
    const resolve = new ResolvePublicTenantByKeyUseCase(repository);
    await create.execute({ tenantKeyRaw: "default", name: "AIアート教室" });

    const tenant = await resolve.execute("default");

    expect(tenant.tenantKey.toString()).toBe("default");
    expect(tenant.isActive()).toBe(true);
  });

  it("throws TenantNotFoundError for an unknown key", async () => {
    const resolve = new ResolvePublicTenantByKeyUseCase(new InMemoryTenantRepository());

    await expect(resolve.execute("unknown")).rejects.toBeInstanceOf(TenantNotFoundError);
  });

  it("throws TenantSuspendedError for a suspended tenant", async () => {
    const repository = new InMemoryTenantRepository();
    const create = new CreateTenantUseCase(repository);
    const update = new UpdateTenantUseCase(repository);
    const resolve = new ResolvePublicTenantByKeyUseCase(repository);
    const created = await create.execute({ tenantKeyRaw: "default", name: "AIアート教室" });
    await update.execute({ id: created.id, status: "SUSPENDED" });

    await expect(resolve.execute("default")).rejects.toBeInstanceOf(TenantSuspendedError);
  });

  it("throws InvalidTenantKeyError for a malformed key without querying the repository", async () => {
    const resolve = new ResolvePublicTenantByKeyUseCase(new InMemoryTenantRepository());

    await expect(resolve.execute("BAD KEY")).rejects.toThrow();
  });
});
