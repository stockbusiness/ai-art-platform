import { afterEach, describe, expect, it, vi } from "vitest";

import { createWorker } from "./create-worker.js";

describe("createWorker", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts and stops without throwing, and does not leak the heartbeat timer", () => {
    vi.useFakeTimers();
    const worker = createWorker({ heartbeatIntervalMs: 1000 });

    expect(() => worker.start()).not.toThrow();
    vi.advanceTimersByTime(5000);
    expect(() => worker.stop()).not.toThrow();

    expect(vi.getTimerCount()).toBe(0);
  });
});
