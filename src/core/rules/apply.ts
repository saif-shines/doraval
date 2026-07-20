import { ruleByCode } from "./registry.js";
import type { EffectiveRule } from "./resolve.js";

export function stampRule<
  T extends {
    severity: "error" | "warning" | "info" | "pass";
    code?: string;
    slug?: string;
    docUrl?: string;
  },
>(
  finding: T,
  code: string,
  effective: Map<string, EffectiveRule>,
  opts?: { keepSeverity?: boolean },
): T | null {
  const rule = ruleByCode(code);
  if (!rule) return finding;

  const state = effective.get(code);
  if (state && !state.enabled) return null;

  const severity = finding.severity === "pass" || opts?.keepSeverity || !state?.overridden
    ? finding.severity
    : state.severity;

  return { ...finding, severity, code: rule.code, slug: rule.slug, docUrl: rule.docUrl };
}
