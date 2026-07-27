import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import { createLogger } from "./logger.js";
import { REDACT_CENSOR } from "./redaction.js";

function createCapturingStream(lines: string[]): Writable {
  return new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
}

describe("createLogger", () => {
  it("redacts sensitive top-level and nested fields", () => {
    const lines: string[] = [];
    const logger = createLogger({ level: "info", name: "test" }, createCapturingStream(lines));

    logger.info({
      password: "super-secret",
      token: "abc123",
      user: { authorization: "Bearer xyz", cookie: "session=1" },
      display_name: "visible",
    });

    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;

    expect(record["password"]).toBe(REDACT_CENSOR);
    expect(record["token"]).toBe(REDACT_CENSOR);
    expect((record["user"] as Record<string, unknown>)["authorization"]).toBe(REDACT_CENSOR);
    expect((record["user"] as Record<string, unknown>)["cookie"]).toBe(REDACT_CENSOR);
    expect(record["display_name"]).toBe("visible");
  });

  it("redacts database connection strings", () => {
    const lines: string[] = [];
    const logger = createLogger({ level: "info", name: "test" }, createCapturingStream(lines));

    logger.info({
      databaseUrl: "postgresql://user:pass@host:5432/db",
      databaseDirectUrl: "postgresql://user:pass@host:5432/db",
      DATABASE_URL: "postgresql://user:pass@host:5432/db",
      DATABASE_DIRECT_URL: "postgresql://user:pass@host:5432/db",
    });

    const record = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    expect(record["databaseUrl"]).toBe(REDACT_CENSOR);
    expect(record["databaseDirectUrl"]).toBe(REDACT_CENSOR);
    expect(record["DATABASE_URL"]).toBe(REDACT_CENSOR);
    expect(record["DATABASE_DIRECT_URL"]).toBe(REDACT_CENSOR);
  });
});
