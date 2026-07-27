import { describe, expect, it } from "vitest";

import { Entity } from "./entity.js";

class SampleEntity extends Entity<string> {
  constructor(id: string) {
    super(id);
  }
}

describe("Entity", () => {
  it("is equal to another entity with the same id", () => {
    expect(new SampleEntity("a").equals(new SampleEntity("a"))).toBe(true);
  });

  it("is not equal to an entity with a different id", () => {
    expect(new SampleEntity("a").equals(new SampleEntity("b"))).toBe(false);
  });
});
