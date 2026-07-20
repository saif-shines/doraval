import { readFileSync, readdirSync, statSync } from "fs";
import { resolve as resolvePath, relative, basename } from "path";
import { loadSkillFromDir, validateSkillModelTagged } from "./skill-validate.js";
import { analyzeDrift, scanScriptSecurity, type ScriptFile } from "./static-skill-checks.js";
import { lintSkill, runJudge, buildLintPrompt, type LintResult } from "./skill-lint.js";
import { findSkillDirs } from "./skill-discovery.js";
import { classifySkillDir, type SkillOrigin } from "./skill-classify.js";
import { detectCapabilities, resolveJudgeMode } from "./capability-detect.js";
import { NetworkError, PrerequisiteError } from "./errors.js";
import { loadPrinciples, checkPrinciplesAgainstContent, buildPrincipleRubric } from "./memory-rubric.js";
import { loadScenarios, buildScenarioPrompt, type Scenario } from "./scenarios.js";
import { readConfig, getEvalConfig } from "./journal-config.js";
import { loadRecentSessions, collectSessionEvidence, type LoadResult } from "./session-evidence.js";
import type { SkillModel } from "./skill-validate.js";
import type { Capabilities } from "./capability-detect.js";
import type { AgentConfig } from "./agent-invoke.js";
import type { EvalConfig } from "./journal-config.js";
import { resolveEffectiveRules, type EffectiveRule } from "./rules/resolve.js";
import { stampRule } from "./rules/apply.js";
import {
  DRIFT_CATEGORY_CODES,
  LINT_CATEGORY_CODES,
  PARSE_FAILURE_CODE,
  PRINCIPLE_CODE,
  SCENARIO_FILE_CODE,
  SCRIPT_SECURITY_CODE,
} from "./rules/bindings.js";
import { ruleByCode } from "./rules/registry.js";

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
  /** Stable public rule/error code. */
  code?: string;
  /** Stable human rule handle. */
  slug?: string;
  /** Resolved doc URL (real site page only — see doc-registry). */
  docUrl?: string;
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
    llm?: { available: boolean; method?: string; prompt?: string; findings: ReviewFinding[] };
    sessions?: { available: boolean; count?: number; findings: ReviewFinding[] };
  };
  scenarioCount?: number;
  summary: { passed: number; warnings: number; errors: number };
  ruleWarnings?: string[];
}

export interface ReviewOptions {
  quick?: boolean;
  deep?: boolean;
  sessions?: boolean;
  agent?: string;
  cwd?: string;
  /** Headless context (from --ci). No caller to delegate to → no-key judge fails hard. */
  ci?: boolean;
  /** Preloaded session evidence (reviewAll threads this; also a test seam). */
  loadedSessions?: LoadResult;
  /** Called before each skill's LLM tier runs (progress reporting). */
  onProgress?: (msg: string) => void;
  /** Test seam: overrides the lintSkill call for the LLM tier. */
  lintFn?: (
    model: SkillModel,
    caps: Capabilities,
    agentCfg: AgentConfig,
    evalCfg: Partial<EvalConfig>,
    platform?: string,
    extraRubric?: string,
    opts?: { ci?: boolean }
  ) => Promise<LintResult>;
  /** Test seam: overrides the judge call for memory-file review's LLM tier. */
  memoryLintFn?: (
    prompt: string,
    caps: Capabilities,
    agentCfg: AgentConfig,
    evalCfg: Partial<EvalConfig>
  ) => Promise<LintResult>;
  /**
   * Test seam: overrides session rule-adherence eval for memory files (backlog #9).
   * When omitted, `runEval` is used when `--sessions` is set and a judge is available.
   */
  memorySessionEvalFn?: (
    primitives: import("./session-parse.js").SessionPrimitives,
    name: string,
    content: string,
    agentCfg: AgentConfig,
    evalCfg: EvalConfig,
  ) => Promise<import("./session-eval.js").EvalResult>;
  /** Test seam: overrides the judge call for scenario-coverage checking. */
  scenarioLintFn?: (
    prompt: string,
    caps: Capabilities,
    agentCfg: AgentConfig,
    evalCfg: Partial<EvalConfig>
  ) => Promise<LintResult>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(3, "0");
}

export function llmTierPlan(effective: Map<string, EffectiveRule>): { runLint: boolean; runScenario: boolean } {
  return {
    runLint: ["R022", "R023", "R024", "R025", "R026"].some((code) => effective.get(code)?.enabled),
    runScenario: effective.get("R027")?.enabled ?? false,
  };
}

function makeFix(text: string): ReviewFinding["fix"] | undefined {
  if (text.includes("Unknown frontmatter field")) return { type: "rename_field", description: text };
  if (text.includes("Missing")) return { type: "add_field", description: text };
  return undefined;
}

function readScriptFiles(scriptsDir: string): ScriptFile[] {
  const out: ScriptFile[] = [];
  function walk(d: string): void {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = resolvePath(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        try {
          if (statSync(full).size > 1_000_000) continue; // skip anything oversized (binaries, etc.)
          out.push({ file: relative(scriptsDir, full), content: readFileSync(full, "utf8") });
        } catch {
          // unreadable (binary, permissions) — skip rather than fail the review
        }
      }
    }
  }
  walk(scriptsDir);
  return out;
}

// ── reviewSkill ────────────────────────────────────────────────────────────────

export async function reviewSkill(dir: string, opts: ReviewOptions = {}): Promise<ReviewResult> {
  const origin = classifySkillDir(dir, { cwd: opts.cwd ?? process.cwd() });
  const loaded = await loadSkillFromDir(dir);

  if (!loaded.ok) {
    const rule = ruleByCode(PARSE_FAILURE_CODE)!;
    const finding: ReviewFinding = {
      id: "struct-001",
      tier: "structure",
      severity: "error",
      message: loaded.error,
      fixable: false,
      code: rule.code,
      slug: rule.slug,
      docUrl: rule.docUrl,
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
  const ruleCfg = await readConfig();
  const { map: effective, warnings: ruleWarnings } = resolveEffectiveRules(ruleCfg, opts.cwd ?? process.cwd());

  // Tier 1: structure
  let sIdx = 1;
  const structFindings: ReviewFinding[] = [];
  for (const { code, result } of validateSkillModelTagged(model, { existingDirs })) {
    const items = [
      ...(result.errors ?? []).map((item) => ({ severity: "error" as const, text: item.text })),
      ...(result.warnings ?? []).map((item) => ({ severity: "warning" as const, text: item.text })),
      ...(result.passes ?? []).map((item) => ({ severity: "pass" as const, text: item.text })),
    ];
    for (const item of items) {
      const fix = item.severity === "pass" ? undefined : makeFix(item.text);
      const finding = stampRule({
        id: `struct-${pad(sIdx++)}`, tier: "structure" as const,
        severity: item.severity, message: item.text, fixable: !!fix, ...(fix ? { fix } : {}),
      }, code, effective);
      if (finding) structFindings.push(finding);
    }
  }

  const scenarioResult = loadScenarios(dir);
  let scenarioCount = 0;
  if (!scenarioResult.ok) {
    const finding = stampRule({
      id: `struct-${pad(sIdx++)}`, tier: "structure" as const,
      severity: "error" as const, message: scenarioResult.error, fixable: false,
    }, SCENARIO_FILE_CODE, effective);
    if (finding) structFindings.push(finding);
  } else if (scenarioResult.scenarios.length > 0) {
    scenarioCount = scenarioResult.scenarios.length;
    const finding = stampRule({
      id: `struct-${pad(sIdx++)}`, tier: "structure" as const, severity: "info" as const,
      message: `${scenarioCount} scenario(s) validated from scenarios.yaml (structure only — behavioral coverage checked in the LLM tier when a judge is available)`,
      fixable: false,
    }, SCENARIO_FILE_CODE, effective);
    if (finding) structFindings.push(finding);
  }

  const structTier: TierResult = {
    passed: structFindings.filter((finding) => finding.severity === "pass").length,
    warnings: structFindings.filter((finding) => finding.severity === "warning").length,
    errors: structFindings.filter((finding) => finding.severity === "error").length,
    findings: structFindings,
  };

  // Tier 2: heuristics
  const desc = String(model.data.description ?? "");
  const drift = analyzeDrift({ description: desc, content: model.content });
  let hIdx = 1;
  const heurFindings: ReviewFinding[] = [];
  for (const item of drift.drifts) {
    const code = DRIFT_CATEGORY_CODES[item.category];
    if (!code) continue;
    const finding = stampRule({
      id: `heur-${pad(hIdx++)}`,
      tier: "heuristics" as const,
      severity: item.drifted ? ("warning" as const) : ("pass" as const),
      message: item.detail,
      fixable: item.drifted,
      ...(item.drifted ? { fix: { type: "content" as const, description: item.detail } } : {}),
    }, code, effective);
    if (finding) heurFindings.push(finding);
  }

  // Tier 2a: scripts/ security scan — outbound network calls, secret prompts.
  // Only runs when a scripts/ dir exists; a clean scan still records a pass so
  // "no scripts/" and "scripts/ reviewed clean" stay distinguishable in output.
  if (existingDirs.includes("scripts")) {
    const scriptFiles = readScriptFiles(resolvePath(dir, "scripts"));
    const scriptHits = scanScriptSecurity(scriptFiles);
    if (scriptHits.length === 0) {
      const finding = stampRule({
        id: `heur-${pad(hIdx++)}`,
        tier: "heuristics" as const,
        severity: "pass" as const,
        message: "scripts/ contains no suspicious network-call or secret-prompt patterns",
        fixable: false,
      }, SCRIPT_SECURITY_CODE, effective);
      if (finding) heurFindings.push(finding);
    } else {
      for (const hit of scriptHits) {
        const finding = stampRule({
          id: `heur-${pad(hIdx++)}`,
          tier: "heuristics" as const,
          severity: "warning" as const,
          message: hit.detail,
          fixable: false,
        }, SCRIPT_SECURITY_CODE, effective);
        if (finding) heurFindings.push(finding);
      }
    }
  }

  // Tier 2b: principle keyword checks (free, from dora memory)
  const principles = loadPrinciples(opts.cwd ?? process.cwd());
  const principleViolations = checkPrinciplesAgainstContent(principles, model.content);
  for (const v of principleViolations) {
    const sev = v.principle.weight >= 7 ? "error" as const : "warning" as const;
    const finding = stampRule({
      id: `heur-${pad(hIdx++)}`,
      tier: "heuristics" as const,
      severity: sev,
      message: `violates "${v.principle.title}" (w${v.principle.weight}) — ${v.detail}`,
      fixable: false,
    }, PRINCIPLE_CODE, effective, { keepSeverity: true });
    if (finding) heurFindings.push(finding);
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
    const cfg = ruleCfg;
    const evalCfg = getEvalConfig(cfg);
    const agentCfg: AgentConfig = cfg?.agent ?? { command: "" };

    const caps = detectCapabilities(evalCfg);
    const mode = resolveJudgeMode({
      apiAvailable: caps.api,
      ci: opts.ci ?? false,
      judgePref: evalCfg.judge,
    });
    const plan = llmTierPlan(effective);

    if (mode === "fail") {
      if (opts.deep) {
        throw new PrerequisiteError({
          code: "E-PRE-004",
          message: "Deep review requires an LLM judge",
        });
      }
      tiers.llm = { available: false, findings: [] };
    } else if (mode === "delegate") {
      const rubricText = buildPrincipleRubric(principles) || undefined;
      const scenarios: Scenario[] = scenarioResult.ok ? scenarioResult.scenarios : [];
      const lintPrompt = plan.runLint ? buildLintPrompt(model, undefined, rubricText) : "";
      const scenarioBlock = plan.runScenario && scenarios.length > 0
        ? [
            lintPrompt ? "\n---" : "",
            "## Scenario Coverage Check",
            "",
            "Evaluate whether this skill handles each scenario correctly.",
            "Only add findings for UNCOVERED scenarios, using category \"coverage\".",
            ...scenarios.map((scenario, index) =>
              `${index + 1}. When: \"${scenario.when}\" → Expected: \"${scenario.expect}\"${scenario.must_not ? ` | Must NOT: \"${scenario.must_not}\"` : ""}`
            ),
          ].filter(Boolean).join("\n")
        : "";
      const prompt = lintPrompt + scenarioBlock;
      tiers.llm = prompt
        ? { available: true, method: "delegated", prompt, findings: [] }
        : { available: false, findings: [] };
    } else {
      const rubricText = buildPrincipleRubric(principles) || undefined;
      const scenarios: Scenario[] = scenarioResult.ok ? scenarioResult.scenarios : [];
      const llmFindings: ReviewFinding[] = [];
      let lIdx = 1;
      let method: string | undefined;
      let available = false;
      let lintFailed = false;


      const stampLintFindings = (findings: Array<{ category: string; severity: ReviewFinding["severity"]; finding: string }>): void => {
        for (const item of findings) {
          const code = LINT_CATEGORY_CODES[item.category];
          if (!code) continue;
          const finding = stampRule({
            id: `llm-${pad(lIdx++)}`, tier: "llm" as const, severity: item.severity,
            message: item.finding, fixable: false,
          }, code, effective);
          if (finding) llmFindings.push(finding);
        }
      };

      if (plan.runLint) {
        opts.onProgress?.(`LLM judge (api) · ${dir}`);
        const result = await (opts.lintFn ?? lintSkill)(model, caps, agentCfg, evalCfg, undefined, rubricText, { ci: opts.ci ?? false });
        if (!result.ok) {
          lintFailed = true;
          if (opts.deep) throw new NetworkError({
            code: "E-NET-002", message: `LLM judge failed: ${result.error}`,
            suggestion: "Re-run, check the API judge credentials, or drop --deep to review without the LLM tier",
          });
        } else {
          available = true;
          method = result.method;
          stampLintFindings(result.output.findings);
        }
      }

      if (!lintFailed && plan.runScenario && scenarios.length > 0) {
        opts.onProgress?.(`Scenario coverage (api) · ${dir}`);
        const result = await (opts.scenarioLintFn ?? runJudge)(buildScenarioPrompt(scenarios, model.content), caps, agentCfg, evalCfg);
        if (!result.ok) {
          if (opts.deep) throw new NetworkError({
            code: "E-NET-002", message: `Scenario coverage judge failed: ${result.error}`,
            suggestion: "Re-run, check the API judge credentials, or drop --deep to review without the LLM tier",
          });
        } else {
          available = true;
          method ??= result.method;
          stampLintFindings(result.output.findings);
        }
      }

      tiers.llm = available ? { available: true, method, findings: llmFindings } : { available: false, findings: [] };
    }
  }

  // Tier 4: sessions — mechanical usage evidence (see plan B20–B22)
  if (!opts.quick) {
    const loadedSess = opts.loadedSessions ?? loadRecentSessions(opts.cwd ?? process.cwd());
    if (opts.sessions && loadedSess.sessions.length === 0) {
      throw new PrerequisiteError({
        code: "E-PRE-003",
        message: "No sessions found. Use your agent, then re-run.",
      });
    }
    if (loadedSess.adaptersDetected.length === 0) {
      tiers.sessions = { available: false, findings: [] };
    } else {
      const skillName = String(model.data.name ?? basename(dir));
      const sessFindings = collectSessionEvidence(skillName, dir, loadedSess, { required: opts.sessions === true });
      tiers.sessions = { available: true, count: loadedSess.sessions.length, findings: sessFindings };
    }
  }

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
    ...(ruleWarnings.length ? { ruleWarnings } : {}),
  };
}

// ── reviewAll ──────────────────────────────────────────────────────────────────

export async function reviewAll(root: string, opts: ReviewOptions = {}): Promise<ReviewResult[]> {
  const dirs = findSkillDirs(root);
  const cwd = opts.cwd ?? root;
  const loadedSessions = opts.quick ? undefined : (opts.loadedSessions ?? loadRecentSessions(cwd));
  const optsWithCwd = { ...opts, cwd, ...(loadedSessions ? { loadedSessions } : {}) };

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