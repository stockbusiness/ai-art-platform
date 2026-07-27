import {
  InvalidTenantKeyError,
  TenantNotFoundError,
  TenantSuspendedError,
} from "@ai-art-platform/domain";
import { describe, expect, it } from "vitest";

import { mapTenantErrorToHttp } from "./public-tenant.controller.js";

describe("mapTenantErrorToHttp", () => {
  it("maps InvalidTenantKeyError to 400 VALIDATION_ERROR", () => {
    const exception = mapTenantErrorToHttp(new InvalidTenantKeyError("bad key"));
    expect(exception.getStatus()).toBe(400);
    expect((exception.getResponse() as { error: { code: string } }).error.code).toBe(
      "VALIDATION_ERROR",
    );
  });

  it("maps TenantNotFoundError to 404 TENANT_NOT_FOUND", () => {
    const exception = mapTenantErrorToHttp(new TenantNotFoundError("not found"));
    expect(exception.getStatus()).toBe(404);
    expect((exception.getResponse() as { error: { code: string } }).error.code).toBe(
      "TENANT_NOT_FOUND",
    );
  });

  it("maps TenantSuspendedError to 403 TENANT_SUSPENDED", () => {
    const exception = mapTenantErrorToHttp(new TenantSuspendedError("suspended"));
    expect(exception.getStatus()).toBe(403);
    expect((exception.getResponse() as { error: { code: string } }).error.code).toBe(
      "TENANT_SUSPENDED",
    );
  });

  it("maps an unknown error to 503 DATABASE_UNAVAILABLE without leaking details", () => {
    const exception = mapTenantErrorToHttp(new Error("connection to 10.0.0.5:5432 refused"));
    expect(exception.getStatus()).toBe(503);
    const body = exception.getResponse() as { error: { code: string; message: string } };
    expect(body.error.code).toBe("DATABASE_UNAVAILABLE");
    expect(body.error.message).not.toContain("10.0.0.5");
  });
});
