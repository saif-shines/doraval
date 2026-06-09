export interface DriftItem {
  drifted: boolean;
  category: string;
  detail: string;
}

export interface SkillDriftInput {
  description: string;
  content: string;
}

export interface SkillDriftResult {
  drifts: DriftItem[];
  driftCount: number;
  total: number;
}

export type DriftCheck = (input: SkillDriftInput) => DriftItem;

// Trigger detection also considers when_to_use (per current Claude Code spec).
// The CLI caller concatenates description + when_to_use before passing.
export function checkTrigger(input: SkillDriftInput): DriftItem {
  const hasTriggers =
    input.description.includes("use when") ||
    input.description.includes("Use when") ||
    input.description.includes("trigger") ||
    input.description.includes("invoke");
  return {
    drifted: !hasTriggers,
    category: "Trigger",
    detail: hasTriggers
      ? "Description includes activation phrases"
      : 'No trigger phrases found — add "Use when..." to description',
  };
}

export function checkStructure(input: SkillDriftInput): DriftItem {
  const hasSteps =
    /^\s*\d+\.\s/m.test(input.content) || /^\s*[-*]\s/m.test(input.content);
  return {
    drifted: !hasSteps,
    category: "Structure",
    detail: hasSteps
      ? "Has step-by-step instructions"
      : "No ordered steps or checklists — agent needs a clear sequence to follow",
  };
}

export function checkVoice(input: SkillDriftInput): DriftItem {
  const hasImperative =
    /\b(Create|Add|Run|Install|Configure|Set|Build|Use|Check|Verify|Ensure)\b/.test(
      input.content
    );
  return {
    drifted: !hasImperative,
    category: "Voice",
    detail: hasImperative
      ? 'Uses imperative voice ("Do X" not "You might X")'
      : "Passive or suggestive phrasing — use direct imperatives",
  };
}

export function checkExample(input: SkillDriftInput): DriftItem {
  const hasCode = input.content.includes("```");
  return {
    drifted: !hasCode,
    category: "Example",
    detail: hasCode
      ? "Has code examples"
      : "No code blocks found — add examples if the skill involves code",
  };
}

export function checkGuardrail(input: SkillDriftInput): DriftItem {
  const hasConstraints =
    /\bMUST\b/.test(input.content) || /\bMUST NOT\b/.test(input.content);
  return {
    drifted: !hasConstraints,
    category: "Guardrail",
    detail: hasConstraints
      ? "Has MUST/MUST NOT constraints"
      : "No explicit constraints — add MUST / MUST NOT guardrails",
  };
}

export function checkClarity(input: SkillDriftInput): DriftItem {
  const ambiguous = input.content.match(
    /\b(maybe|possibly|consider|you might want to|perhaps)\b/gi
  );
  const drifted = !!ambiguous && ambiguous.length > 0;
  return {
    drifted,
    category: "Clarity",
    detail: drifted
      ? `Ambiguous phrasing detected: ${ambiguous!.slice(0, 3).join(", ")}`
      : "No ambiguous language found",
  };
}

const checks: DriftCheck[] = [
  checkTrigger,
  checkStructure,
  checkVoice,
  checkExample,
  checkGuardrail,
  checkClarity,
];

export function analyzeDrift(input: SkillDriftInput): SkillDriftResult {
  const drifts = checks.map(check => check(input));
  return { drifts, driftCount: drifts.filter(d => d.drifted).length, total: drifts.length };
}
