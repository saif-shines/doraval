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

export function analyzeDrift(input: SkillDriftInput): SkillDriftResult {
  const drifts: DriftItem[] = [];
  const desc = input.description;
  const body = input.content;

  const hasTriggers =
    desc.includes("use when") ||
    desc.includes("Use when") ||
    desc.includes("trigger") ||
    desc.includes("invoke");
  drifts.push({
    drifted: !hasTriggers,
    category: "Trigger",
    detail: hasTriggers
      ? "Description includes activation phrases"
      : 'No trigger phrases found — add "Use when..." to description',
  });

  const hasSteps =
    /^\s*\d+\.\s/m.test(body) || /^\s*[-*]\s/m.test(body);
  drifts.push({
    drifted: !hasSteps,
    category: "Structure",
    detail: hasSteps
      ? "Has step-by-step instructions"
      : "No ordered steps or checklists — agent needs a clear sequence to follow",
  });

  const hasImperative =
    /\b(Create|Add|Run|Install|Configure|Set|Build|Use|Check|Verify|Ensure)\b/.test(
      body
    );
  drifts.push({
    drifted: !hasImperative,
    category: "Voice",
    detail: hasImperative
      ? 'Uses imperative voice ("Do X" not "You might X")'
      : "Passive or suggestive phrasing — use direct imperatives",
  });

  const hasCode = body.includes("```");
  drifts.push({
    drifted: !hasCode,
    category: "Example",
    detail: hasCode
      ? "Has code examples"
      : "No code blocks found — add examples if the skill involves code",
  });

  const hasConstraints =
    /\bMUST\b/.test(body) || /\bMUST NOT\b/.test(body);
  drifts.push({
    drifted: !hasConstraints,
    category: "Guardrail",
    detail: hasConstraints
      ? "Has MUST/MUST NOT constraints"
      : "No explicit constraints — add MUST / MUST NOT guardrails",
  });

  const ambiguous = body.match(
    /\b(maybe|possibly|consider|you might want to|perhaps)\b/gi
  );
  const hasDriftedClarity = ambiguous && ambiguous.length > 0;
  drifts.push({
    drifted: !!hasDriftedClarity,
    category: "Clarity",
    detail: hasDriftedClarity
      ? `Ambiguous phrasing detected: ${ambiguous!.slice(0, 3).join(", ")}`
      : "No ambiguous language found",
  });

  const driftCount = drifts.filter((d) => d.drifted).length;

  return { drifts, driftCount, total: drifts.length };
}
