import { loadSkillFromDir, validateSkillModel } from "./skill-validate.js";
import { analyzeDrift } from "./static-skill-checks.js";
import { lintSkill } from "./skill-lint.js";
import { findSkillDirs } from "./skill-discovery.js";
import { classifySkillDir, type SkillOrigin } from "./skill-classify.js";
import { detectCapabilities } from "./capability-detect.js";
import { PrerequisiteError } from "./errors.js";
import { loadPrinciples, checkPrinciplesAgainstContent, buildPrincipleRubric } from "./memory-rubric.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ReviewTier = "structure" | "heuristics" | "llm" | "sessions";

export interface ReviewFinding {
  id: string;
  tier: ReviewTier;
  severity: "error" | "warning" | "info" | "pass";
  message: string;
  file?: string;
  line?: number;
  fixable: boolean;
  fix?: { type: "rename_field" | "add_field" | "content"; description: string };
}

interface TierResult {
  passed: number;
  warnings: number;
  errors: number;
  findings: ReviewFinding[];
}

export interface ReviewResult {
  path: string;
  origin: SkillOrigin;
  tiers: {
    structure: TierResult;
    heuristics: TierResult;
    llm?: { available: boolean; method?: string; findings: ReviewFinding[] };
    sessions?: { available: boolean; count?: number; findings: ReviewFinding[] };
  };
  summary: { passed: number; warnings: number; errors: number };
}

export interface ReviewOptions {
  quick?: boolean;
  deep?: boolean;
  sessions?: boolean;
  agent?: string;
  cwd?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(3, "0");
}

function makeFix(text: string): ReviewFinding["fix"] | undefined {
  if (text.includes("Unknown frontmatter field")) return { type: "rename_field", description: text };
  if (text.includes("Missing")) return { type: "add_field", description: text };
  return undefined;
}

// ── reviewSkill ────────────────────────────────────────────────────────────────

export async function reviewSkill(dir: string, opts: ReviewOptions = {}): Promise<ReviewResult> {
  const origin = classifySkillDir(dir, { cwd: opts.cwd ?? process.cwd() });
  const loaded = await loadSkillFromDir(dir);

  if (!loaded.ok) {
    const finding: ReviewFinding = {
      id: "struct-001",
      tier: "structure",
      severity: "error",
      message: loaded.error,
      fixable: false,
    };
    return {
      path: dir,
      origin,
      tiers: {
        structure: { passed: 0, warnings: 0, errors: 1, findings: [finding] },
        heuristics: { passed: 0, warnings: 0, errors: 0, findings: [] },
      },
      summary: { passed: 0, warnings: 0, errors: 1 },
    };
  }

  const { model, existingDirs } = loaded;

  // Tier 1: structure
  const validation = validateSkillModel(model, { existingDirs });
  let sIdx = 1;
  const structFindings: ReviewFinding[] = [
    ...validation.errors.map((e) => {
      const fix = makeFix(e.text);
      return {
        id: `struct-${pad(sIdx++)}`, tier: "structure" as const,
        severity: "error" as const, message: e.text, fixable: !!fix, ...(fix ? { fix } : {}),
      };
    }),
    ...validation.warnings.map((w) => {
      const fix = makeFix(w.text);
      return {
        id: `struct-${pad(sIdx++)}`, tier: "structure" as const,
        severity: "warning" as const, message: w.text, fixable: !!fix, ...(fix ? { fix } : {}),
      };
    }),
    ...validation.passes.map((p) => ({
      id: `struct-${pad(sIdx++)}`, tier: "structure" as const,
      severity: "pass" as const, message: p.text, fixable: false,
    })),
  ];

  const structTier: TierResult = {
    passed: validation.passes.length,
    warnings: validation.warnings.length,
    errors: validation.errors.length,
    findings: structFindings,
  };

  // Tier 2: heuristics
  const desc = String(model.data.description ?? "");
  const drift = analyzeDrift({ description: desc, content: model.content });
  let hIdx = 1;
  const heurFindings: ReviewFinding[] = drift.drifts.map((d) => ({
    id: `heur-${pad(hIdx++)}`,
    tier: "heuristics" as const,
    severity: d.drifted ? ("warning" as const) : ("pass" as const),
    message: d.detail,
    fixable: d.drifted,
    ...(d.drifted ? { fix: { type: "content" as const, description: d.detail } } : {}),
  }));

  // Tier 2b: principle keyword checks (free, from dora memory)
  const principles = loadPrinciples(opts.cwd ?? process.cwd());
  const principleViolations = checkPrinciplesAgainstContent(principles, model.content);
  for (const v of principleViolations) {
    const sev = v.principle.weight >= 7 ? "error" as const : "warning" as const;
    heurFindings.push({
      id: `heur-${pad(hIdx++)}`,
      tier: "heuristics" as const,
      severity: sev,
      message: `violates "${v.principle.title}" (w${v.principle.weight}) — ${v.detail}`,
      fixable: false,
    });
  }

  const heurErrors = heurFindings.filter(f => f.severity === "error").length;
  const heurWarnings = heurFindings.filter(f => f.severity === "warning").length;
  const heurPassed = heurFindings.filter(f => f.severity === "pass").length;

  const heurTier: TierResult = {
    passed: heurPassed,
    warnings: heurWarnings,
    errors: heurErrors,
    findings: heurFindings,
  };

  const tiers: ReviewResult["tiers"] = { structure: structTier, heuristics: heurTier };

  // Tier 3: llm
  if (!opts.quick) {
    const caps = detectCapabilities();
    if (caps.preferred === "none") {
      if (opts.deep) {
        throw new PrerequisiteError({
          code: "E-PRE-002",
          message: "Deep review requires an LLM judge",
        });
      }
      tiers.llm = { available: false, findings: [] };
    } else {
      // Inject project principles into the LLM prompt as additional rubric context
      const rubricText = buildPrincipleRubric(principles);
      const platform = rubricText || undefined;
      const result = await lintSkill(model, caps, { command: "" }, {}, platform);
      if (result.ok) {
        let lIdx = 1;
        tiers.llm = {
          available: true,
          method: result.method,
          findings: result.output.findings.map((f) => ({
            id: `llm-${pad(lIdx++)}`,
            tier: "llm" as const,
            severity: f.severity,
            message: f.finding,
            fixable: false,
          })),
        };
      } else {
        tiers.llm = { available: false, findings: [] };
      }
    }
  }

  // TODO: session adapters integration — tier 4 is a stub
  tiers.sessions = { available: false, findings: [] };

  const all = [
    ...structTier.findings,
    ...heurTier.findings,
    ...(tiers.llm?.findings ?? []),
    ...(tiers.sessions?.findings ?? []),
  ];

  return {
    path: dir,
    origin,
    tiers,
    summary: {
      passed: all.filter((f) => f.severity === "pass").length,
      warnings: all.filter((f) => f.severity === "warning").length,
      errors: all.filter((f) => f.severity === "error").length,
    },
  };
}

// ── reviewAll ──────────────────────────────────────────────────────────────────

export async function reviewAll(root: string, opts: ReviewOptions = {}): Promise<ReviewResult[]> {
  const dirs = findSkillDirs(root);
  const optsWithCwd = { ...opts, cwd: opts.cwd ?? root };

  // Sequential when LLM tier is active (non-quick) to avoid rate limits.
  // Parallel for quick mode (tiers 1–2 are CPU-only).
  let results: ReviewResult[];
  if (opts.quick) {
    results = await Promise.all(dirs.map((d) => reviewSkill(d, optsWithCwd)));
  } else {
    results = [];
    for (const d of dirs) results.push(await reviewSkill(d, optsWithCwd));
  }
  return results.sort((a, b) => b.summary.errors - a.summary.errors);
}