import { describe, expect, it } from "vitest";

import type { AuthenticatedAdminContext } from "./authenticated-admin-context.js";
import { GetCurrentAdminUseCase } from "./get-current-admin.use-case.js";

describe("GetCurrentAdminUseCase", () => {
  it("maps the AuthenticatedAdminContext to an AdminSummary without leaking session internals", () => {
    const context: AuthenticatedAdminContext = {
      sessionId: "s1",
      csrfTokenHash: "csrf-hash-should-not-leak",
      adminId: "a1",
      tenantId: "t1",
      tenantKey: "acme",
      email: "owner@acme.example.com",
      name: "Owner",
      role: "TENANT_OWNER",
      permissions: ["admin:self:read", "tenant:read"],
    };

    const summary = new GetCurrentAdminUseCase().execute(context);

    expect(summary).toEqual({
      id: "a1",
      tenantId: "t1",
      tenantKey: "acme",
      email: "owner@acme.example.com",
      name: "Owner",
      role: "TENANT_OWNER",
    });
    expect(JSON.stringify(summary)).not.toContain("csrf-hash-should-not-leak");
  });
});
