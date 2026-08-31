import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { describe, expect, test } from "bun:test";
import { repoRoot, runDoraval } from "./helpers/spawn-cli.js";

const VERBS = ["new", "boot", "pause", "resume", "list", "open"] as const;
const FAMILY = ["ask-dora", "review-with-dora", "grilling-for-routine", "writing-for-routine"] as const;

function read(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8");
}

describe("dora harness docs lockstep", () => {
  test("npx skills add ships the four family names and no old skill names", () => {
    const shipped = readdirSync(join(repoRoot, "skills")).filter((name) =>
      existsSync(join(repoRoot, "skills", name, "SKILL.md")),
    );
    expect(shipped.sort()).toEqual([...FAMILY].sort());
    expect(existsSync(join(repoRoot, "skills/doraval/SKILL.md"))).toBe(false);
    expect(existsSync(join(repoRoot, "skills/grill-routine/SKILL.md"))).toBe(false);
    for (const name of FAMILY) {
      expect(read(`skills/${name}/SKILL.md`)).toMatch(new RegExp(`^name:\\s*${name}`, "m"));
    }
  });

  test("README, website, and AGENTS.md name the same four skills", () => {
    const readme = read("README.md");
    const agents = read("AGENTS.md");
    const site = [
      read("apps/website/content/get-started/skills.mdx"),
      read("apps/website/content/commands/harness.mdx"),
      read("apps/website/content/commands/index.mdx"),
    ].join("\n");
    for (const name of FAMILY) {
      expect(readme).toContain(name);
      expect(agents).toContain(name);
      expect(site).toContain(name);
    }
    expect(readme).not.toMatch(/skills\/doraval\//);
    expect(agents).not.toMatch(/skills\/doraval\//);
    expect(site).not.toMatch(/grill-routine/);
    expect(readme).not.toMatch(/grill-routine/);
    expect(agents).not.toMatch(/grill-routine/);
  });

  test("README, website, and shipped skill name the same verbs", () => {
    const readme = read("README.md");
    const site = read("apps/website/content/commands/index.mdx");
    const harness = read("apps/website/content/commands/harness.mdx");
    const skill = read("skills/review-with-dora/SKILL.md");
    const catalog = read("skills/review-with-dora/references/commands.md");
    for (const verb of VERBS) {
      const line = `dora harness ${verb}`;
      expect(readme).toContain(line);
      expect(site).toContain(line);
      expect(harness).toContain(line);
      expect(catalog).toContain(verb);
    }
    expect(skill).toContain("dora harness");
    for (const verb of VERBS) expect(skill).toContain(`dora harness ${verb}`);
    expect(skill).toContain("ask-dora");
    expect(skill).toContain("grilling-for-routine");
    expect(catalog).toContain("ask-dora");
    expect(catalog).toContain("grilling-for-routine");
    expect(site.toLowerCase()).toContain("routine");
    expect(catalog.toLowerCase()).toContain("routine");
    expect(harness).toContain("hermes mcp login scalekit");
    expect(catalog).toContain("hermes mcp login scalekit");
    expect(skill).toContain("hermes mcp login scalekit");
    expect(harness).toMatch(/fire on wake/i);
    expect(harness).toMatch(/internal teammate/i);
    expect(harness).not.toMatch(/buy|pricing|for customers|sign up today/i);
    expect(harness).not.toMatch(/Discord|Webflow|OOO calendar/i);
  });

  test("help and the JSON map name harness and the verbs", () => {
    const help = runDoraval(["--help"]);
    expect(help.exitCode).toBe(0);
    const root = help.stdout.toLowerCase();
    expect(root).toContain("harness");
    for (const verb of VERBS) expect(root).toContain(verb);

    const json = runDoraval(["--help", "--json"]);
    expect(json.exitCode).toBe(0);
    const m = JSON.parse(json.stdout);
    const harness = m.commands.find((c: { name: string }) => c.name === "harness");
    expect(harness).toBeDefined();
    const blob = JSON.stringify(harness);
    for (const verb of VERBS) expect(blob).toContain(verb);

    const group = runDoraval(["harness", "--help"]);
    expect(group.exitCode).toBe(0);
    for (const verb of VERBS) expect(group.stdout + group.stderr).toContain(verb);

    const newHelp = runDoraval(["harness", "new", "--help"]);
    expect(newHelp.exitCode).toBe(0);
    const newText = newHelp.stdout + newHelp.stderr;
    expect(newText).toContain("ask-dora");
    expect(newText).toContain("grilling-for-routine");
    expect(newText).not.toMatch(/grill-routine/);
    expect(newText).not.toMatch(/skills\/doraval/);
  });

  test("Reader docs do not sell a customer product or force a sample use case", () => {
    const harness = read("apps/website/content/commands/harness.mdx");
    expect(harness).toMatch(/internal teammate/i);
    expect(harness).not.toMatch(/buy|pricing|for customers|sign up today/i);
    expect(harness).not.toMatch(/Discord|Webflow|OOO calendar/i);
  });
});
