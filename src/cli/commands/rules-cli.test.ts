import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const homes: string[] = [];

function runRules(args: string[], config?: string) {
  const home = mkdtempSync(join(tmpdir(), "dora-rules-cli-"));
  homes.push(home);
  if (config !== undefined) writeFileSync(join(home, "config.yml"), config);
  const result = Bun.spawnSync(["bun", "run", "src/cli/index.ts", "rules", ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DORAVAL_HOME: home, NO_COLOR: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

function expectJsonOnlyError(result: ReturnType<typeof runRules>) {
  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe("");
  const parsed = JSON.parse(result.stderr);
  expect(parsed.error.message).toBeString();
}

afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

describe("rules machine-mode errors", () => {
  test.each([
    ["--json", ["list", "--package", "bogus", "--json"]],
    ["--format json", ["explain", "nope", "--format", "json"]],
    ["--ci", ["off", "no-injection", "--ci"]],
  ])("%s emits JSON only", (_label, args) => {
    expectJsonOnlyError(runRules(args));
  });

  test("invalid package preview exits 1 in table mode", () => {
    const result = runRules(["list", "--package", "bogus"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown package "bogus"');
  });

  test("malformed persisted config is controlled JSON", () => {
    const result = runRules(["list", "--json"], "journal: nope\n");
    expectJsonOnlyError(result);
    expect(result.stderr).not.toContain("TypeError");
    expect(result.stderr).not.toContain(" at ");
  });

  test.each([
    ["on --json", ["on", "--json"]],
    ["off --format json", ["off", "--format", "json"]],
    ["set missing rule --ci", ["set", "--ci"]],
    ["set missing assignment --json", ["set", "body-size", "--json"]],
    ["package --format json", ["package", "--format", "json"]],
    ["explain --ci", ["explain", "--ci"]],
  ])("missing positional for %s emits JSON only", (_name, args) => {
    const result = runRules(args);
    expectJsonOnlyError(result);
    expect(result.stderr).not.toContain("USAGE");
  });

  test("invalid persisted RulesConfig is a controlled human error", () => {
    const config = "journal:\n  repo: ''\n  projects: {}\nrules:\n  overrides: nope\n";
    const result = runRules(["list"], config);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("rules.overrides must be an object");
    expect(result.stderr).not.toContain(" at ");
  });

  test("invalid persisted RulesConfig is controlled JSON", () => {
    const config = "journal:\n  repo: ''\n  projects: {}\nrules:\n  package: bogus\n";
    const result = runRules(["list", "--json"], config);
    expectJsonOnlyError(result);
    expect(result.stderr).toContain("rules.package");
  });

  test("simultaneous scope flags fail before mutation", () => {
    const config = "journal:\n  repo: ''\n  projects: {}\n";
    const result = runRules(["on", "body-size", "--global", "--project", "--json"], config);
    expectJsonOnlyError(result);
    expect(result.stderr).toContain("Choose either --global or --project");
  });
});

describe("rules list human layout", () => {
  test("prints package header, tier groups, and off for disabled rules", () => {
    const result = runRules(["list"]);
    expect(result.exitCode).toBe(0);
    const out = result.stdout + result.stderr;
    expect(out).toMatch(/package: recommended · scope: global · \d+ on · \d+ off/);
    expect(out).toContain("Structure");
    expect(out).toContain("Heuristic");
    expect(out).toMatch(/\[ \] R009\s+advanced-fields\s+off/);
  });
});

describe("rules explain scope", () => {
  const config = [
    "journal:",
    "  repo: ''",
    "  projects:",
    "    demo:",
    "      remote_path: ''",
    "      local_path: ''",
    "      source_dir: /repo",
    "      rules:",
    "        overrides:",
    "          body-size: off",
    "rules:",
    "  overrides:",
    "    body-size: error",
    "",
  ].join("\n");

  test("--global and --project select the explained effective state", () => {
    const global = runRules(["explain", "body-size", "--global", "--cwd", "/repo"], config);
    const project = runRules(["explain", "body-size", "--project", "--cwd", "/repo"], config);
    expect(global.exitCode).toBe(0);
    expect(global.stderr).toContain("Effective:       error");
    expect(project.exitCode).toBe(0);
    expect(project.stderr).toContain("Effective:       disabled");
  });
});
