import { loadSkillFromDir, validateSkillModel } from "./skill-validate.js";
import { analyzeDrift } from "./static-skill-checks.js";
import { lintSkill, type LintResult } from "./skill-lint.js";
import { findSkillDirs } from "./skill-discovery.js";
import { classifySkillDir, type SkillOrigin } from "./skill-classify.js";
import { detectCapabilities } from "./capability-detect.js";
import { NetworkError, PrerequisiteError } from "./errors.js";
import { loadPrinciples, checkPrinciplesAgainstContent, buildPrincipleRubric } from "./memory-rubric.js";
import { loadScenarios } from "./scenarios.js";
import { readConfig, getEvalConfig } from "./journal-config.js";
import type { SkillModel } from "./skill-validate.js";
import type { Capabilities } from "./capability-detect.js";
import type { AgentConfig } from "./agent-invoke.js";
import type { EvalConfig } from "./journal-config.js";

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
  scenarioCount?: number;
  summary: { passed: number; warnings: number; errors: number };
}

export interface ReviewOptions {
  quick?: boolean;
  deep?: boolean;
  sessions?: boolean;
  agent?: string;
  cwd?: string;
  /** Test seam: overrides the lintSkill call for the LLM tier. */
  lintFn?: (
    model: SkillModel,
    caps: Capabilities,
    agentCfg: AgentConfig,
    evalCfg: Partial<EvalConfig>,
    platform?: string,
    extraRubric?: string
  ) => Promise<LintResult>;
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

  // Tier 1b: scenario file validation
  const scenarioResult = loadScenarios(dir);
  let scenarioCount = 0;
  if (!scenarioResult.ok) {
    structFindings.push({
      id: `struct-${pad(sIdx++)}`, tier: "structure" as const,
      severity: "error" as const, message: scenarioResult.error, fixable: false,
    });
  } else if (scenarioResult.scenarios.length > 0) {
    scenarioCount = scenarioResult.scenarios.length;
    structFindings.push({
      id: `struct-${pad(sIdx++)}`, tier: "structure" as const,
      severity: "info" as const,
      message: `${scenarioCount} scenario(s) validated from scenarios.yaml (structure only — behavioral evaluation lands with the coverage tier)`,
      fixable: false,
    });
  }

  const structTier: TierResult = {
    passed: validation.passes.length,
    warnings: validation.warnings.length,
    errors: validation.errors.length + (!scenarioResult.ok ? 1 : 0),
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
    // Honor credentials/model/judge-preference stored via `dora config set eval.*`,
    // not just env vars — and use the configured agent command when present.
    const cfg = await readConfig();
    const evalCfg = getEvalConfig(cfg);
    const agentCfg: AgentConfig = cfg?.agent ?? { command: "" };

    const caps = detectCapabilities(evalCfg);
    if (caps.preferred === "none") {
      if (opts.deep) {
        throw new PrerequisiteError({
          code: "E-PRE-002",
          message: "Deep review requires an LLM judge",
        });
      }
      tiers.llm = { available: false, findings: [] };
    } else {
      // Principles go in as an explicit rubric section the judge must enforce
      // (NOT via the platform slot — that's a PLATFORM_CONTEXT lookup key).
      const rubricText = buildPrincipleRubric(principles) || undefined;
      const lint = opts.lintFn ?? lintSkill;
      const result = await lint(model, caps, agentCfg, evalCfg, undefined, rubricText);
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
        // A judge exists but the call failed. Under --deep that is
        // "could not run", not a silent downgrade to tiers 1-2.
        if (opts.deep) {
          throw new NetworkError({
            code: "E-NET-002",
            message: `LLM judge failed: ${result.error}`,
            suggestion: "Re-run, check the judge CLI/API credentials, or drop --deep to review without the LLM tier",
          });
        }
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
    ...(scenarioCount > 0 ? { scenarioCount } : {}),
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