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
});
