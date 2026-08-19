import { classifySkillDir, type SkillOrigin } from "./skill-classify.js";
import { loadSkillFromDir, validateSkillModelTagged, type SkillModel } from "./skill-validate.js";
import { analyzeDrift } from "./static-skill-checks.js";
import { stampRule } from "./rules/apply.js";
import type { EffectiveRule } from "./rules/resolve.js";
import { DRIFT_CATEGORY_CODES, PARSE_FAILURE_CODE } from "./rules/bindings.js";
import { padIdx } from "./review-control.js";
import type { Finding } from "./finding.js";

export interface SkillCheckResult {
  path: string;
  origin: SkillOrigin;
  findings: Finding[];
  model?: SkillModel;
  existingDirs?: string[];
}

function makeFix(text: string): Finding["fix"] | undefined {
  if (text.includes("Unknown frontmatter field")) return { type: "rename_field", description: text };
  if (text.includes("Missing")) return { type: "add_field", description: text };
  return undefined;
}

/** Mechanical Skill-check: validate + drift + stamp. Scan and Review only present. */
export async function checkSkill(
  dir: string,
  effective: Map<string, EffectiveRule>,
  opts?: { cwd?: string },
): Promise<SkillCheckResult> {
  const origin = classifySkillDir(dir, { cwd: opts?.cwd ?? process.cwd() });
  const loaded = await loadSkillFromDir(dir);

  if (!loaded.ok) {
    const finding = stampRule({
      id: "struct-001",
      tier: "structure" as const,
      severity: "error" as const,
      message: loaded.error,
      fixable: false,
    }, PARSE_FAILURE_CODE, effective);
    return { path: dir, origin, findings: finding ? [finding] : [] };
  }

  const { model, existingDirs } = loaded;
  const findings: Finding[] = [];
  let sIdx = 1;
  for (const { code, result } of validateSkillModelTagged(model, { existingDirs })) {
    const items = [
      ...(result.errors ?? []).map((item) => ({ severity: "error" as const, text: item.text, hint: item.hint })),
      ...(result.warnings ?? []).map((item) => ({ severity: "warning" as const, text: item.text, hint: item.hint })),
      ...(result.passes ?? []).map((item) => ({ severity: "pass" as const, text: item.text, hint: item.hint })),
    ];
    for (const item of items) {
      const fix = item.severity === "pass" ? undefined : makeFix(item.text);
      const finding = stampRule({
        id: `struct-${padIdx(sIdx++)}`,
        tier: "structure" as const,
        severity: item.severity,
        message: item.text,
        ...(item.hint ? { hint: item.hint } : {}),
        fixable: !!fix,
        ...(fix ? { fix } : {}),
      }, code, effective);
      if (finding) findings.push(finding);
    }
  }

  let hIdx = 1;
  const drift = analyzeDrift({
    description: String(model.data.description ?? ""),
    content: model.content,
  });
  for (const item of drift.drifts) {
    const code = DRIFT_CATEGORY_CODES[item.category];
    if (!code) continue;
    const finding = stampRule({
      id: `heur-${padIdx(hIdx++)}`,
      tier: "heuristics" as const,
      severity: item.drifted ? ("warning" as const) : ("pass" as const),
      message: item.detail,
      fixable: item.drifted,
      ...(item.drifted ? { fix: { type: "content" as const, description: item.detail } } : {}),
    }, code, effective);
    if (finding) findings.push(finding);
  }

  return { path: dir, origin, findings, model, existingDirs };
}
