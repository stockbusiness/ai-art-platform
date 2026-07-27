import { describe, expect, it } from "vitest";

import { AppController } from "../src/app.controller.js";
import { AppService } from "../src/app.service.js";

describe("AppController", () => {
  it("returns development info without touching a database", () => {
    const controller = new AppController(new AppService());

    const info = controller.getDevInfo();
    expect(info.name).toBe("@ai-art-platform/api");
    expect(typeof info.version).toBe("string");
    expect(typeof info.environment).toBe("string");
  });
});
