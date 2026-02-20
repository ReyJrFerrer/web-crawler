import { expect, test, describe } from "bun:test";
import { DuplicateEliminator } from "../src/agents/eliminator";

describe("Duplicate Eliminator", () => {
  const eliminator = new DuplicateEliminator();

  test("should identify new URLs as unique", () => {
    expect(eliminator.isNew("http://example.com/1")).toBe(true);
    expect(eliminator.isNew("http://example.com/2")).toBe(true);
  });

  test("should identify duplicate URLs as NOT new", () => {
    eliminator.isNew("http://example.com/3");
    expect(eliminator.isNew("http://example.com/3")).toBe(false);
  });
});
