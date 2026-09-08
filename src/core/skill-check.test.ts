import { describe, expect, test } from "bun:test";
import { join, resolve } from "path";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { checkSkill } from "./skill-check.js";
import { resolveEffectiveRules } from "./rules/resolve.js";

const FIXTURES = resolve(import.meta.dir, "../../test/fixtures");
const rules = () => resolveEffectiveRules(null).map;

describe("checkSkill", () => {
  test("valid skill yields stamped structure and heuristic Findings", async () => {
    const result = await checkSkill(resolve(FIXTURES, "skills/minimal-good"), rules());
    expect(result.model).toBeDefined();
    expect(result.findings.some((f) => f.tier === "structure" && f.code === "R006")).toBe(true);
    expect(result.findings.some((f) => f.tier === "heuristics")).toBe(true);
    expect(result.findings.every((f) => f.tier === "structure" || f.tier === "heuristics")).toBe(true);
    for (const f of result.findings) {
      expect(f.code).toMatch(/^R\d{3}$/);
      expect(f.slug).toBeTruthy();
    }
  });

  test("load failure is one stamped structure Finding", async () => {
    const result = await checkSkill("/nonexistent/skill", rules());
    expect(result.model).toBeUndefined();
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      tier: "structure",
      severity: "error",
      code: "R002",
      slug: "frontmatter-parse",
    });
  });

  test("broken local reference is R011; real references/ file passes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dora-l3-"));
    mkdirSync(join(dir, "references"));
    writeFileSync(join(dir, "SKILL.md"), [
      "---", "name: link-check", "description: Use when testing local links.", "---",
      "", "# link-check", "", "See [missing](references/MISSING.md).", "",
    ].join("\n"));
    const missing = await checkSkill(dir, rules());
    expect(missing.findings.some((f) => f.code === "R011" && /MISSING/.test(f.message) && f.severity !== "pass")).toBe(true);

    writeFileSync(join(dir, "references", "output.md"), "# ok\n");
    writeFileSync(join(dir, "SKILL.md"), [
      "---", "name: link-check", "description: Use when testing local links.", "---",
      "", "# link-check", "", "See [out](references/output.md).", "",
    ].join("\n"));
    const ok = await checkSkill(dir, rules());
    expect(ok.findings.some((f) => /MISSING/.test(f.message))).toBe(false);
    expect(ok.findings.some((f) => /does not exist/.test(f.message))).toBe(false);
  });
});
