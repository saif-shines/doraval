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
    expect(text).toMatch(/pocket/i);
    expect(text).toContain("dora harness new");
    expect(text).toMatch(/Hermes is missing/);
    expect(text).toMatch(/Do not load the grill/);
    expect(text).toContain("discover-connectors");
    expect(text).toContain("scalekit-inc/authstack");
    expect(text).toContain("https://docs.scalekit.com/dev-kit/build-with-ai/");
    expect(text).toMatch(/reload skills|restart the session/);
    expect(text).toMatch(/Do not invent a catalog/);
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

  test("grilling-for-routine names Fixed step after loop-able, with freeze rules", () => {
    const text = skill("grilling-for-routine");
    const loopIdx = text.indexOf("## Loop-able");
    const pocketIdx = text.indexOf("## Pocket");
    const fixedIdx = text.indexOf("## Fixed step");
    expect(loopIdx).toBeGreaterThan(-1);
    expect(pocketIdx).toBeGreaterThan(loopIdx);
    expect(fixedIdx).toBeGreaterThan(pocketIdx);
    expect(text).toMatch(/one job, one machine, one user/);
    expect(text).toMatch(/Not a new object/);
    expect(text).toMatch(/optional/i);
    expect(text).toMatch(/deterministic/i);
    expect(text).toMatch(/one good one-pass|after one good/i);
    expect(text).toMatch(/Name one seam/);
    expect(text).toMatch(/expected result from that one-pass/);
    expect(text).toMatch(/did the agent invent/);
    expect(text).toMatch(/do not freeze/i);
    expect(text).toMatch(/Do not load implement or code-review/);
    expect(text).toMatch(/The human accepts/);
    expect(text).toMatch(/Tick never writes/);
    expect(text).toMatch(/does not author files/);
    expect(text).toMatch(/temp folder/);
    expect(text).toMatch(/before the first save/);
    expect(text).toMatch(/Skill copy/);
    expect(text).toMatch(/--skills-run/);
    expect(text).toMatch(/--script/);
    expect(text).toMatch(/--no-agent/);
    expect(text).not.toMatch(/programmatize/i);
    expect(text).not.toMatch(/You are/);
    expect(text).not.toContain("—");
  });

  test("writing-for-routine writes prompt.md and the Fixed-step Skill", () => {
    const text = skill("writing-for-routine");
    expect(text).toMatch(/prompt\.md/);
    expect(text).toMatch(/Fixed-step Skill|Fixed step/);
    expect(text).toMatch(/Skill script/);
    expect(text).toMatch(/inside that Skill|inside the Skill/);
    expect(text).toMatch(/no top-level scripts directory/);
    expect(text).toMatch(/does not repeat|Do not repeat/);
    expect(text).toMatch(/Judgment/);
    expect(text).toMatch(/Dora Finding/);
    expect(text).toMatch(/--script/);
    expect(text).not.toMatch(/programmatize/i);
    expect(text).not.toMatch(/You are/);
    expect(text).not.toContain("—");
  });

  test("ask-dora and review-with-dora do not gain a Fixed-step job", () => {
    expect(skill("ask-dora")).not.toMatch(/Fixed step/);
    expect(skill("review-with-dora")).not.toMatch(/Fixed step/);
  });
});
