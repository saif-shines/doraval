import { describe, expect, test } from "bun:test";
import { buildMemoryContext } from "./context.js";
import type { Principle } from "../../../core/memory-rubric.js";

function principle(overrides: Partial<Principle>): Principle {
  return {
    id: "01ABC",
    title: "Example principle",
    body: "",
    weight: 5,
    tags: [],
    status: "active",
    source: "project",
    ...overrides,
  };
}

describe("buildMemoryContext", () => {
  test("returns empty string for no principles", () => {
    expect(buildMemoryContext([])).toBe("");
  });

  test("groups by weight into Strong/Friction/Nudge bands", () => {
    const out = buildMemoryContext([
      principle({ title: "Hard rule", weight: 9 }),
      principle({ title: "Soft rule", weight: 5 }),
      principle({ title: "Tiny nudge", weight: 2 }),
    ]);
    expect(out).toContain("Strong (weight 7–10)");
    expect(out).toContain("Hard rule");
    expect(out).toContain("Friction (weight 4–6)");
    expect(out).toContain("Soft rule");
    expect(out).toContain("Nudges (weight 1–3)");
    expect(out).toContain("Tiny nudge");
  });

  test("includes body text when present", () => {
    const out = buildMemoryContext([
      principle({ title: "Has body", weight: 8, body: "Some rationale." }),
    ]);
    expect(out).toContain("Some rationale.");
  });
});
