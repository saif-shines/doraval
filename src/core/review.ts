import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { resolve as resolvePath, relative, basename } from "path";
import { scanScriptSecurity, type ScriptFile } from "./static-skill-checks.js";
import { checkSkill } from "./skill-check.js";
import { runJudge, buildLintPrompt, type LintResult, type JudgeCallOpts } from "./skill-lint.js";
import { findSkillDirs, isSkillDir } from "./skill-discovery.js";
import type { SkillOrigin } from "./skill-classify.js";
import { NetworkError, PrerequisiteError } from "./errors.js";
import { loadPrinciples, checkPrinciplesAgainstContent, buildPrincipleRubric } from "./memory-rubric.js";
import { loadScenarios, buildScenarioPrompt, type Scenario } from "./scenarios.js";
import { loadRecentSessions, collectSessionEvidence, type LoadResult } from "./session-evidence.js";
import type { Capabilities } from "./capability-detect.js";
import type { AgentConfig } from "./agent-invoke.js";
import type { EvalConfig } from "./journal-config.js";
import type { EffectiveRule } from "./rules/resolve.js";
import { stampRule } from "./rules/apply.js";
import {
  LINT_CATEGORY_CODES,
  PRINCIPLE_CODE,
  SCENARIO_FILE_CODE,
  SCRIPT_SECURITY_CODE,
} from "./rules/bindings.js";
import { loadReviewContext, resolveJudgeContext, padIdx, tallyFindings } from "./review-control.js";
import { MEMORY_FILE_NAMES, reviewMemoryFile } from "./memory-file-review.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export type { Finding, FindingTier as ReviewTier } from "./finding.js";
export type ReviewFinding = Finding;

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
  /** Cap how many artifacts to review (first N after path sort). */
  limit?: number;
  /** Called before each skill's LLM tier runs (progress reporting). */
  onProgress?: (msg: string) => void;
  /** Test seam: one Judge fake. Ticket #24 owns the real Judge. */
  judge?: (
    prompt: string,
    caps: Capabilities,
    agentCfg: AgentConfig,
    evalCfg: Partial<EvalConfig>,
    opts?: JudgeCallOpts
  ) => Promise<LintResult>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const pad = padIdx;

export function llmTierPlan(effective: Map<string, EffectiveRule>): { runLint: boolean; runScenario: boolean } {
  return {
    runLint: ["R022", "R023", "R024", "R025", "R026"].some((code) => effective.get(code)?.enabled),
    runScenario: effective.get("R027")?.enabled ?? false,
  };
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

async function reviewSkill(dir: string, opts: ReviewOptions = {}): Promise<ReviewResult> {
  const { config: ruleCfg, effective, ruleWarnings } = await loadReviewContext(opts.cwd ?? process.cwd());
  const checked = await checkSkill(dir, effective, { cwd: opts.cwd });
  const origin = checked.origin;

  if (!checked.model) {
    const structTier = tallyFindings(checked.findings);
    return {
      path: dir,
      origin,
      tiers: {
        structure: structTier,
        heuristics: { passed: 0, warnings: 0, errors: 0, findings: [] },
      },
      summary: { passed: structTier.passed, warnings: structTier.warnings, errors: structTier.errors },
      ...(ruleWarnings.length ? { ruleWarnings } : {}),
    };
  }

  const model = checked.model;
  const existingDirs = checked.existingDirs ?? [];
  const structFindings: ReviewFinding[] = checked.findings.filter((f) => f.tier === "structure");
  let sIdx = structFindings.length + 1;

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

  const structTier: TierResult = tallyFindings(structFindings);

  // Tier 2: heuristics (drift from Skill-check; scripts + principles stay Review-only)
  const heurFindings: ReviewFinding[] = checked.findings.filter((f) => f.tier === "heuristics");
  let hIdx = heurFindings.length + 1;

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
  const principles = effective.get(PRINCIPLE_CODE)?.enabled
    ? loadPrinciples(opts.cwd ?? process.cwd())
    : [];
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

  const heurTier: TierResult = tallyFindings(heurFindings);

  const tiers: ReviewResult["tiers"] = { structure: structTier, heuristics: heurTier };

  // Tier 3: llm
  if (!opts.quick) {
    // Mode decided once here; leaf runJudge/lintSkill receive mode (no re-route).
    const { evalCfg, agentCfg, caps, mode: resolvedMode } = resolveJudgeContext(ruleCfg, { ci: opts.ci });
    const mode = opts.judge ? "api" : resolvedMode;
    const plan = llmTierPlan(effective);
    const judgeOpts: JudgeCallOpts = { ci: opts.ci ?? false, mode };
    const judge = opts.judge ?? runJudge;

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
        ? lintPrompt
          ? [
              "\n---",
              "## Scenario Coverage Check",
              "",
              "Evaluate whether this skill handles each scenario correctly.",
              "Only add findings for UNCOVERED scenarios, using category \"coverage\".",
              ...scenarios.map((scenario, index) =>
                `${index + 1}. When: \"${scenario.when}\" → Expected: \"${scenario.expect}\"${scenario.must_not ? ` | Must NOT: \"${scenario.must_not}\"` : ""}`
              ),
            ].join("\n")
          : buildScenarioPrompt(scenarios, model.content)
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
        const result = await judge(buildLintPrompt(model, undefined, rubricText), caps, agentCfg, evalCfg, judgeOpts);
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
        const result = await judge(
          buildScenarioPrompt(scenarios, model.content),
          caps,
          agentCfg,
          evalCfg,
          judgeOpts,
        );
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
      const sessFindings = collectSessionEvidence(skillName, dir, loadedSess, { required: opts.sessions === true })
        .map((finding) => stampRule(finding, finding.code!, effective))
        .filter((finding): finding is ReviewFinding => finding !== null);
      tiers.sessions = { available: true, count: loadedSess.sessions.length, findings: sessFindings };
    }
  }

  const all = [
    ...structTier.findings,
    ...heurTier.findings,
    ...(tiers.llm?.findings ?? []),
    ...(tiers.sessions?.findings ?? []),
  ];
  const summary = tallyFindings(all);

  return {
    path: dir,
    origin,
    tiers,
    ...(scenarioCount > 0 ? { scenarioCount } : {}),
    summary: { passed: summary.passed, warnings: summary.warnings, errors: summary.errors },
    ...(ruleWarnings.length ? { ruleWarnings } : {}),
  };
}

function listCwdMemory(cwd: string): string[] {
  const out: string[] = [];
  for (const name of MEMORY_FILE_NAMES) {
    const file = resolvePath(cwd, name);
    if (existsSync(file)) out.push(file);
  }
  return out;
}

/** Paths `review(path)` would visit, sorted. Does not run checks. */
export function listReviewTargets(path: string, cwd: string = process.cwd()): string[] {
  if (isSkillDir(path)) {
    return [path, ...listCwdMemory(cwd)].sort((a, b) => a.localeCompare(b));
  }
  if (existsSync(path) && statSync(path).isFile()) return [path];
  return [...findSkillDirs(path), ...listCwdMemory(cwd)].sort((a, b) => a.localeCompare(b));
}

/** Public Review interface: one path in, one list out. */
export async function review(path: string, opts: ReviewOptions = {}): Promise<ReviewResult[]> {
  const cwd = opts.cwd ?? process.cwd();
  let targets = listReviewTargets(path, cwd);
  if (opts.limit != null) targets = targets.slice(0, opts.limit);

  const loadedSessions = opts.quick ? undefined : (opts.loadedSessions ?? loadRecentSessions(cwd));
  const per = { ...opts, cwd, ...(loadedSessions ? { loadedSessions } : {}) };
  const one = (target: string) =>
    isSkillDir(target) ? reviewSkill(target, per) : reviewMemoryFile(target, per);

  if (opts.quick) return Promise.all(targets.map(one));
  const results: ReviewResult[] = [];
  for (const target of targets) results.push(await one(target));
  return results;
}