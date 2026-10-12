import { describe, expect, test } from "bun:test";
import { EXAMPLES, exampleTrace } from "./examples.ts";

describe("example traces", () => {
  test("two labeled samples, no cost, and a file read on the first", () => {
    expect(EXAMPLES).toHaveLength(2);
    for (const item of EXAMPLES) {
      expect(item.row.title.startsWith("Example")).toBe(true);
      expect(item.facts.costUsd).toBeUndefined();
      expect(item.turns[0]?.prompt.length).toBeGreaterThan(0);
    }
    expect(exampleTrace("example:login")?.turns[0]?.tools[0]?.name).toBe("read_file");
    expect(exampleTrace("claude-code:abc")).toBeNull();
  });
});
