import { describe, expect, test } from "bun:test";
import {
  analyzeDrift,
  checkTrigger, checkStructure, checkVoice,
  checkExample, checkGuardrail, checkClarity,
} from "./static-skill-checks.js";

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

describe("checkTrigger", () => {
  test("pass when description has trigger phrase", () => {
    expect(checkTrigger({ description: "Use when running tests.", content: "" }).drifted).toBe(false);
  });
  test("drift when no trigger phrase", () => {
    expect(checkTrigger({ description: "A general skill.", content: "" }).drifted).toBe(true);
  });
});

describe("checkStructure", () => {
  test("pass with numbered list", () => {
    expect(checkStructure({ description: "", content: "1. Do this\n2. Do that" }).drifted).toBe(false);
  });
  test("pass with bullet list", () => {
    expect(checkStructure({ description: "", content: "- Do this\n- Do that" }).drifted).toBe(false);
  });
  test("drift with plain prose", () => {
    expect(checkStructure({ description: "", content: "Wall of text." }).drifted).toBe(true);
  });
});

describe("checkVoice", () => {
  test("pass with imperative verb", () => {
    expect(checkVoice({ description: "", content: "Run the tests." }).drifted).toBe(false);
  });
  test("drift with passive prose", () => {
    expect(checkVoice({ description: "", content: "Tests should be run." }).drifted).toBe(true);
  });
});

describe("checkExample", () => {
  test("pass with code block", () => {
    expect(checkExample({ description: "", content: "Do this:\n```bash\necho hi\n```" }).drifted).toBe(false);
  });
  test("drift without code block", () => {
    expect(checkExample({ description: "", content: "No examples here." }).drifted).toBe(true);
  });
});

describe("checkGuardrail", () => {
  test("pass with MUST constraint", () => {
    expect(checkGuardrail({ description: "", content: "You MUST do this." }).drifted).toBe(false);
  });
  test("pass with MUST NOT constraint", () => {
    expect(checkGuardrail({ description: "", content: "You MUST NOT skip." }).drifted).toBe(false);
  });
  test("drift without constraints", () => {
    expect(checkGuardrail({ description: "", content: "Do the thing." }).drifted).toBe(true);
  });
});

describe("checkClarity", () => {
  test("pass with no ambiguous words", () => {
    expect(checkClarity({ description: "", content: "Run the suite." }).drifted).toBe(false);
  });
  test("drift with ambiguous words", () => {
    const result = checkClarity({ description: "", content: "Maybe consider this." });
    expect(result.drifted).toBe(true);
    expect(result.detail).toContain("Maybe");
  });
});
