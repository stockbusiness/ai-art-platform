import {
  AdminAuthenticationFailedError,
  AdminForbiddenError,
  AdminTooManyAttemptsError,
  AdminUnauthenticatedError,
} from "@ai-art-platform/domain";
import { describe, expect, it } from "vitest";

import { mapAdminAuthErrorToHttp } from "./admin-auth-error.mapper.js";

function body(exception: ReturnType<typeof mapAdminAuthErrorToHttp>) {
  return exception.getResponse() as {
    error: { code: string; message: string; requestId: string };
  };
}

describe("mapAdminAuthErrorToHttp", () => {
  it("maps AdminAuthenticationFailedError to 401 AUTHENTICATION_FAILED", () => {
    const exception = mapAdminAuthErrorToHttp(new AdminAuthenticationFailedError("x"), "req-123");
    expect(exception.getStatus()).toBe(401);
    expect(body(exception).error.code).toBe("AUTHENTICATION_FAILED");
  });

  it("maps AdminTooManyAttemptsError to 429 TOO_MANY_ATTEMPTS", () => {
    const exception = mapAdminAuthErrorToHttp(new AdminTooManyAttemptsError("x"), "req-123");
    expect(exception.getStatus()).toBe(429);
    expect(body(exception).error.code).toBe("TOO_MANY_ATTEMPTS");
  });

  it("maps AdminUnauthenticatedError to 401 UNAUTHENTICATED", () => {
    const exception = mapAdminAuthErrorToHttp(new AdminUnauthenticatedError("x"), "req-123");
    expect(exception.getStatus()).toBe(401);
    expect(body(exception).error.code).toBe("UNAUTHENTICATED");
  });

  it("maps AdminForbiddenError to 403 FORBIDDEN", () => {
    const exception = mapAdminAuthErrorToHttp(new AdminForbiddenError("x"), "req-123");
    expect(exception.getStatus()).toBe(403);
    expect(body(exception).error.code).toBe("FORBIDDEN");
  });

  it("maps an unrecognized error to 503 AUTH_SERVICE_UNAVAILABLE, not 401 (P0-7)", () => {
    const exception = mapAdminAuthErrorToHttp(new Error("connect ECONNREFUSED"), "req-123");
    expect(exception.getStatus()).toBe(503);
    expect(body(exception).error.code).toBe("AUTH_SERVICE_UNAVAILABLE");
  });

  it("never leaks the original error's message into the response body", () => {
    const exception = mapAdminAuthErrorToHttp(
      new Error('password authentication failed for user "admin" at host db.internal'),
      "req-123",
    );
    const serialized = JSON.stringify(body(exception));
    expect(serialized).not.toContain("db.internal");
    expect(serialized).not.toContain("password authentication failed");
  });

  it("echoes the provided requestId verbatim on every mapped error, never generating its own", () => {
    for (const error of [
      new AdminAuthenticationFailedError("x"),
      new AdminTooManyAttemptsError("x"),
      new AdminUnauthenticatedError("x"),
      new AdminForbiddenError("x"),
      new Error("unexpected"),
    ]) {
      const exception = mapAdminAuthErrorToHttp(error, "the-exact-request-id");
      expect(body(exception).error.requestId).toBe("the-exact-request-id");
    }
  });
});
