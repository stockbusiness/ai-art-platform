import { describe, expect, it } from "vitest";

import { withEnv } from "./with-env.js";

describe("withEnv", () => {
  it("sets and restores an existing variable", async () => {
    process.env["SAMPLE_VAR"] = "original";

    await withEnv({ SAMPLE_VAR: "overridden" }, () => {
      expect(process.env["SAMPLE_VAR"]).toBe("overridden");
    });

    expect(process.env["SAMPLE_VAR"]).toBe("original");
    delete process.env["SAMPLE_VAR"];
  });

  it("removes a variable that did not exist before", async () => {
    delete process.env["SAMPLE_VAR_NEW"];

    await withEnv({ SAMPLE_VAR_NEW: "temp" }, () => {
      expect(process.env["SAMPLE_VAR_NEW"]).toBe("temp");
    });

    expect(process.env["SAMPLE_VAR_NEW"]).toBeUndefined();
  });
});
