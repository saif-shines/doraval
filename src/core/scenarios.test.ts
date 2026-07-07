import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { loadScenarios, buildScenarioPrompt, type Scenario } from "./scenarios.js";

// ── Temp dir helpers ──────────────────────────────────────────────

let tempDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `doraval-scenario-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(tempDir, { recursive: true });
});

afterEach(() => {
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// ── loadScenarios ─────────────────────────────────────────────────

describe("loadScenarios", () => {
  test("returns ok:true with empty array when no file exists", () => {
    const result = loadScenarios(tempDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenarios).toEqual([]);
    }
  });

  test("parses valid scenarios.yaml with when+expect", () => {
    writeFileSync(
      join(tempDir, "scenarios.yaml"),
      [
        '- when: "deploy to staging"',
        '  expect: "runs tests before deploying"',
        '- when: "rollback production"',
        '  expect: "asks for confirmation first"',
      ].join("\n"),
    );

    const result = loadScenarios(tempDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenarios).toHaveLength(2);
      expect(result.scenarios[0]).toEqual({
        when: "deploy to staging",
        expect: "runs tests before deploying",
      });
      expect(result.scenarios[1]).toEqual({
        when: "rollback production",
        expect: "asks for confirmation first",
      });
    }
  });

  test("parses scenarios with optional must_not", () => {
    writeFileSync(
      join(tempDir, "scenarios.yaml"),
      [
        '- when: "deploy with failing tests"',
        '  expect: "refuses and cites the guardrail"',
        '  must_not: "deploys without test pass"',
      ].join("\n"),
    );

    const result = loadScenarios(tempDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenarios).toHaveLength(1);
      expect(result.scenarios[0]!.must_not).toBe("deploys without test pass");
    }
  });

  test("returns ok:false for invalid YAML", () => {
    writeFileSync(join(tempDir, "scenarios.yaml"), "{{invalid yaml::");

    const result = loadScenarios(tempDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Invalid YAML");
    }
  });

  test("returns ok:false when not an array (object)", () => {
    writeFileSync(
      join(tempDir, "scenarios.yaml"),
      'when: "something"\nexpect: "something else"',
    );

    const result = loadScenarios(tempDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("must be a YAML array");
    }
  });

  test("returns ok:false when not an array (string)", () => {
    writeFileSync(join(tempDir, "scenarios.yaml"), '"just a string"');

    const result = loadScenarios(tempDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("must be a YAML array");
    }
  });

  test('returns ok:false when "when" is missing', () => {
    writeFileSync(
      join(tempDir, "scenarios.yaml"),
      '- expect: "does something"',
    );

    const result = loadScenarios(tempDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('"when" is required');
    }
  });

  test('returns ok:false when "expect" is missing', () => {
    writeFileSync(
      join(tempDir, "scenarios.yaml"),
      '- when: "user does something"',
    );

    const result = loadScenarios(tempDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('"expect" is required');
    }
  });

  test('returns ok:false when "must_not" is empty string', () => {
    writeFileSync(
      join(tempDir, "scenarios.yaml"),
      [
        '- when: "deploy"',
        '  expect: "deploys cleanly"',
        '  must_not: ""',
      ].join("\n"),
    );

    const result = loadScenarios(tempDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('"must_not" must be a non-empty string');
    }
  });

  test("returns ok:false when scenario item is not an object", () => {
    writeFileSync(
      join(tempDir, "scenarios.yaml"),
      '- "just a string item"',
    );

    const result = loadScenarios(tempDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("must be an object");
    }
  });
});

// ── buildScenarioPrompt ──────────────────────────────────────────

describe("buildScenarioPrompt", () => {
  const scenarios: Scenario[] = [
    { when: "deploy to staging", expect: "runs tests first" },
    { when: "deploy with failures", expect: "refuses", must_not: "deploys anyway" },
  ];
  const skillContent = "# Deploy Skill\n\nAlways run tests before deploying.";

  test("includes all scenarios with numbering", () => {
    const prompt = buildScenarioPrompt(scenarios, skillContent);
    expect(prompt).toContain('1. When: "deploy to staging"');
    expect(prompt).toContain('2. When: "deploy with failures"');
  });

  test("includes must_not when present", () => {
    const prompt = buildScenarioPrompt(scenarios, skillContent);
    expect(prompt).toContain('Must NOT: "deploys anyway"');
    // First scenario has no must_not — should not include pipe separator
    expect(prompt).toContain('Expected: "runs tests first"');
    const line1 = prompt.split("\n").find(l => l.startsWith("1."))!;
    expect(line1).not.toContain("Must NOT");
  });

  test("includes skill content", () => {
    const prompt = buildScenarioPrompt(scenarios, skillContent);
    expect(prompt).toContain("# Deploy Skill");
    expect(prompt).toContain("Always run tests before deploying.");
  });
});
