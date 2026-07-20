import { describe, expect, test } from "bun:test";
import {
  GEN_END,
  GEN_START,
  packagesForRule,
  renderCatalog,
  renderGeneratedBlock,
  scaffoldRulePage,
  severityLabel,
  spliceGeneratedRegion,
} from "./docs.js";
import { RULES, ruleByCode } from "./registry.js";

describe("severityLabel", () => {
  test("info renders as FYI", () => {
    expect(severityLabel("info")).toBe("FYI");
    expect(severityLabel("error")).toBe("error");
    expect(severityLabel("warning")).toBe("warning");
  });
});

describe("packagesForRule", () => {
  test("locked rule is in every built-in package's effective membership", () => {
    expect(packagesForRule("R003")).toContain("strict");
  });

  test("R009 advanced-fields is only in strict", () => {
    expect(packagesForRule("R009")).toEqual(["strict"]);
  });
});

describe("renderCatalog", () => {
  test("one table row per rule", () => {
    const md = renderCatalog();
    for (const rule of RULES) expect(md).toContain(`/reference/rules/${rule.code}`);
    const rows = md.split("\n").filter((line) => line.startsWith("| R"));
    expect(rows.length).toBe(RULES.length);
  });
});

describe("renderGeneratedBlock", () => {
  test("contains code, slug, tier, FYI-mapped severity, packages, locked", () => {
    const block = renderGeneratedBlock(ruleByCode("R003")!);
    expect(block).toContain("R003");
    expect(block).toContain("no-injection");
    expect(block).toContain("structure");
    expect(block).toContain("Locked");
    expect(block).not.toContain(GEN_START);
  });
});

describe("spliceGeneratedRegion", () => {
  test("replaces only the marker region, preserves outside prose", () => {
    const existing = [
      "---",
      "title: R003 · no-injection",
      "---",
      "",
      "## What",
      "Custom hand-written prose about injection.",
      "",
      GEN_START,
      "OLD GENERATED",
      GEN_END,
      "",
      "## Why",
      "More prose.",
    ].join("\n");
    const out = spliceGeneratedRegion(existing, "NEW GENERATED");
    expect(out).toContain("Custom hand-written prose about injection.");
    expect(out).toContain("More prose.");
    expect(out).toContain("NEW GENERATED");
    expect(out).not.toContain("OLD GENERATED");
  });

  test("throws when markers absent", () => {
    expect(() => spliceGeneratedRegion("no markers here", "X")).toThrow(/marker/i);
  });

  test("throws when either marker is duplicated", () => {
    expect(() => spliceGeneratedRegion(`${GEN_START}\n${GEN_START}\n${GEN_END}`, "X")).toThrow(/duplicate/i);
    expect(() => spliceGeneratedRegion(`${GEN_START}\n${GEN_END}\n${GEN_END}`, "X")).toThrow(/duplicate/i);
  });
});

describe("scaffoldRulePage", () => {
  test("new page carries frontmatter, markers, and prose stubs", () => {
    const page = scaffoldRulePage(ruleByCode("R007")!);
    expect(page).toContain("title: R007 · body-size");
    expect(page).toContain("hidden: true");
    expect(page).toContain(GEN_START);
    expect(page).toContain(GEN_END);
    expect(page).toContain("## What");
    expect(page).toContain("## How to fix");
  });
});
