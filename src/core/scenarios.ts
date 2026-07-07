import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { YAML } from "bun";

export interface Scenario {
  when: string;    // required — user request
  expect: string;  // required — expected behavior
  must_not?: string; // optional — forbidden behavior
}

export type ScenarioLoadResult =
  | { ok: true; scenarios: Scenario[] }
  | { ok: false; error: string };

/**
 * Load and validate scenarios.yaml from a skill directory.
 * Returns ok:false with error message for malformed files (tier-1 finding, not a crash).
 * Returns ok:true with empty array if file doesn't exist (no scenarios = fine).
 */
export function loadScenarios(skillDir: string): ScenarioLoadResult {
  const filePath = join(skillDir, "scenarios.yaml");
  if (!existsSync(filePath)) {
    return { ok: true, scenarios: [] };
  }

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (e) {
    return { ok: false, error: `Cannot read scenarios.yaml: ${(e as Error).message}` };
  }

  let parsed: unknown;
  try {
    parsed = YAML.parse(raw);
  } catch (e) {
    return { ok: false, error: `Invalid YAML in scenarios.yaml: ${(e as Error).message}` };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: "scenarios.yaml must be a YAML array of scenario objects" };
  }

  const scenarios: Scenario[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (!item || typeof item !== "object") {
      return { ok: false, error: `Scenario ${i + 1}: must be an object` };
    }
    const obj = item as Record<string, unknown>;
    if (typeof obj.when !== "string" || !obj.when.trim()) {
      return { ok: false, error: `Scenario ${i + 1}: "when" is required and must be a non-empty string` };
    }
    if (typeof obj.expect !== "string" || !obj.expect.trim()) {
      return { ok: false, error: `Scenario ${i + 1}: "expect" is required and must be a non-empty string` };
    }
    const scenario: Scenario = {
      when: obj.when.trim(),
      expect: obj.expect.trim(),
    };
    if (obj.must_not !== undefined) {
      if (typeof obj.must_not !== "string" || !obj.must_not.trim()) {
        return { ok: false, error: `Scenario ${i + 1}: "must_not" must be a non-empty string if provided` };
      }
      scenario.must_not = obj.must_not.trim();
    }
    scenarios.push(scenario);
  }

  return { ok: true, scenarios };
}

/**
 * Build a coverage prompt for tier-3 LLM judging.
 * For each scenario, ask: "given this skill, would the agent do `expect`?"
 */
export function buildScenarioPrompt(scenarios: Scenario[], skillContent: string): string {
  const lines = [
    "## Scenario Coverage Check",
    "",
    "Given this skill's instructions, evaluate each scenario.",
    "For each, answer COVERED (the skill would handle this correctly) or UNCOVERED (the skill lacks guidance for this).",
    "",
    "SKILL CONTENT:",
    skillContent,
    "",
    "SCENARIOS:",
  ];

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i]!;
    lines.push(`${i + 1}. When: "${s.when}" → Expected: "${s.expect}"${s.must_not ? ` | Must NOT: "${s.must_not}"` : ""}`);
  }

  lines.push("", 'Respond with JSON: { "results": [{ "scenario": 1, "verdict": "COVERED"|"UNCOVERED", "reason": "..." }] }');

  return lines.join("\n");
}
