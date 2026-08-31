import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, test } from "bun:test";
import { repoRoot, runDoraval } from "./helpers/spawn-cli.js";

function skill(name: string): string {
  return readFileSync(join(repoRoot, "skills", name, "SKILL.md"), "utf8");
}

describe("ask-dora skill family (tickets 85-87)", () => {
  test("dora review --quick on each family skill exits 0", () => {
    for (const name of ["ask-dora", "review-with-dora", "grilling-for-routine", "writing-for-routine"] as const) {
      const r = runDoraval(["review", `skills/${name}`, "--quick", "--format", "json"]);
      expect(r.exitCode).toBe(0);
      const rows = JSON.parse(r.stdout) as Array<{ path: string; summary: { errors: number } }>;
      const skillRow = rows.find((row) => row.path.replace(/\\/g, "/").endsWith(`skills/${name}`));
      expect(skillRow).toBeDefined();
      expect(skillRow!.summary.errors).toBe(0);
    }
  });

  test("ask-dora is a user-invoked router that names the other three", () => {
    const text = skill("ask-dora");
    expect(text).toMatch(/disable-model-invocation:\s*true/);
    expect(text).toContain("review-with-dora");
    expect(text).toContain("grilling-for-routine");
    expect(text).toContain("writing-for-routine");
    expect(text).toMatch(/review/i);
    expect(text).toMatch(/fix/i);
    expect(text).toMatch(/unused/i);
    expect(text).toMatch(/scan/i);
    expect(text).toMatch(/routine idea/i);
    expect(text).toMatch(/\bloop\b/i);
    expect(text).toMatch(/recurring/i);
    expect(text).toMatch(/internal teammate/i);
    expect(text).not.toMatch(/You are/);
    expect(text).not.toContain("—");
    expect(text).not.toMatch(/Mechanical fix/i);
    expect(text).not.toMatch(/done-when/i);
    expect(text).not.toMatch(/skills to \*\*run\*\*/i);
  });

  test("review-with-dora holds the Runner loop", () => {
    const text = skill("review-with-dora");
    expect(text).toMatch(/^name:\s*review-with-dora/m);
    expect(text).toContain("dora review --quick");
    expect(text).toContain("dora fix");
    expect(text).toContain("--brief");
    expect(text).toContain("exit 0");
    expect(text).toContain("replace");
    expect(text).not.toMatch(/You are/);
    expect(text).not.toContain("—");
  });

  test("writing-for-routine teaches steps and done-when", () => {
    const text = skill("writing-for-routine");
    expect(text).toMatch(/^name:\s*writing-for-routine/m);
    expect(text).toMatch(/steps/i);
    expect(text).toMatch(/done-when/i);
    expect(text).toMatch(/second-person/i);
    expect(text).toMatch(/em dash/i);
    expect(text).toMatch(/internal teammate/i);
    expect(text).not.toMatch(/You are/);
    expect(text).not.toContain("—");
    expect(text).not.toMatch(/matt|pocock|writing-for-agents/i);
  });
});
