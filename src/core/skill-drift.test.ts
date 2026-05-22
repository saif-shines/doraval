import { describe, expect, test } from "bun:test";
import { analyzeDrift } from "./skill-drift.js";

const alignedSkill = {
  description: "Use when running tests.",
  content: `# Skill

1. Run the suite
2. Verify output

Ensure all checks pass. MUST follow the rubric. MUST NOT skip steps.

\`\`\`bash
echo hello
\`\`\``,
};

describe("analyzeDrift", () => {
  test("returns zero drift for a rubric-aligned skill", () => {
    const result = analyzeDrift(alignedSkill);
    expect(result.total).toBe(6);
    expect(result.driftCount).toBe(0);
    expect(result.drifts.every((d) => !d.drifted)).toBe(true);
  });

  test("detects trigger drift", () => {
    const result = analyzeDrift({
      ...alignedSkill,
      description: "A skill with no activation phrase.",
    });
    const trigger = result.drifts.find((d) => d.category === "Trigger");
    expect(trigger?.drifted).toBe(true);
  });

  test("detects structure drift", () => {
    const result = analyzeDrift({
      ...alignedSkill,
      content: "Wall of text with no steps or lists.",
    });
    const structure = result.drifts.find((d) => d.category === "Structure");
    expect(structure?.drifted).toBe(true);
  });

  test("detects clarity drift from ambiguous words", () => {
    const result = analyzeDrift({
      ...alignedSkill,
      content: alignedSkill.content + "\n\nMaybe consider this approach.",
    });
    const clarity = result.drifts.find((d) => d.category === "Clarity");
    expect(clarity?.drifted).toBe(true);
    expect(clarity?.detail).toContain("Maybe");
  });

  test("detects guardrail drift when MUST constraints are absent", () => {
    const result = analyzeDrift({
      description: "Use when testing.",
      content: "1. Run tests\n\n```\necho hi\n```",
    });
    const guardrail = result.drifts.find((d) => d.category === "Guardrail");
    expect(guardrail?.drifted).toBe(true);
  });
});
