import { describe, expect, test } from "bun:test";
import { prompt, promptSelect } from "./prompt.js";

// bun test runs with non-TTY stdin, so the interactive path is never
// entered — these pin the fallback contract that CI/agents rely on.
describe("prompt (non-TTY)", () => {
  test("returns the fallback without blocking", async () => {
    expect(await prompt("Name", "fallback-value")).toBe("fallback-value");
  });

  test("promptSelect returns the fallback option", async () => {
    const v = await promptSelect("Intent", [
      { value: "self", label: "self" },
      { value: "distribute", label: "distribute" },
    ], "self");
    expect(v).toBe("self");
  });
});
