import { describe, expect, test } from "bun:test";
import { buildCapabilities } from "./capabilities.js";

describe("buildCapabilities", () => {
  test("manifest has version, scan command, exit codes, examples", () => {
    const m = buildCapabilities();
    expect(m.version).toMatch(/^\d+\.\d+\.\d+/);
    const scan = m.commands.find((c) => c.name === "scan")!;
    expect(scan).toBeDefined();
    expect(scan.exit_codes["0"]).toBeDefined();
    expect(scan.exit_codes["1"]).toBeDefined();
    expect(scan.exit_codes["2"]).toBeDefined();
    expect(scan.examples.length).toBeGreaterThanOrEqual(2);
    expect(scan.flags["--format"]!.values).toEqual(["table", "json"]);
  });

  test("intelligence block reflects tier availability", () => {
    const m = buildCapabilities();
    expect(m.intelligence.mechanical).toBe(true);
    expect(m.intelligence.heuristic).toBe(true);
    expect(["api", "delegate"]).toContain(m.intelligence.llm.via);
  });

  test("skill unused is read-only; skill remove/restore stay writes", () => {
    const m = buildCapabilities();
    const unused = m.commands.find((c) => c.name === "skill unused")!;
    const skill = m.commands.find((c) => c.name === "skill")!;
    expect(unused).toBeDefined();
    expect(unused.label).toBe("read-only");
    expect(unused.examples).toContain("dora skill unused");
    expect(unused.flags["--yes"]).toBeUndefined();
    expect(unused.flags["--dry-run"]).toBeUndefined();
    expect(unused.flags["--global"]).toBeUndefined();
    expect(unused.flags["--last"]).toBeDefined();
    expect(unused.flags["--since"]).toBeDefined();
    expect(skill).toBeDefined();
    expect(skill.label).toBe("writes");
    expect(skill.examples.some((e) => e.includes("remove"))).toBe(true);
    expect(skill.examples.some((e) => e.includes("new"))).toBe(true);
    expect(skill.examples.some((e) => e.includes("unused"))).toBe(false);
  });

  test("review mentions Session health; no analyse verb", () => {
    const m = buildCapabilities();
    const review = m.commands.find((c) => c.name === "review")!;
    expect(review.label).toBe("read-only");
    expect(review.description).toMatch(/Session health/i);
    expect(m.commands.some((c) => c.name === "analyse" || c.name === "analyze")).toBe(false);
  });
});
