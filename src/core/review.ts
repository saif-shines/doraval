import { readFileSync, readdirSync, statSync } from "fs";
import { resolve as resolvePath, relative, basename } from "path";
import { loadSkillFromDir, validateSkillModel } from "./skill-validate.js";
import { analyzeDrift, scanScriptSecurity, type ScriptFile } from "./static-skill-checks.js";
import { lintSkill, runJudge, type LintResult } from "./skill-lint.js";
import { findSkillDirs } from "./skill-discovery.js";
import { classifySkillDir, type SkillOrigin } from "./skill-classify.js";
import { detectCapabilities } from "./capability-detect.js";
import { NetworkError, PrerequisiteError } from "./errors.js";
import { loadPrinciples, checkPrinciplesAgainstContent, buildPrincipleRubric } from "./memory-rubric.js";
import { loadScenarios, buildScenarioPrompt, type Scenario } from "./scenarios.js";
import { readConfig, getEvalConfig } from "./journal-config.js";
import { loadRecentSessions, collectSessionEvidence, type LoadResult } from "./session-evidence.js";
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
    extraRubric?: string
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
      message: `${scenarioCount} scenario(s) validated from scenarios.yaml (structure only — behavioral coverage checked in the LLM tier when a judge is available)`,
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

  // Tier 2a: scripts/ security scan — outbound network calls, secret prompts.
  // Only runs when a scripts/ dir exists; a clean scan still records a pass so
  // "no scripts/" and "scripts/ reviewed clean" stay distinguishable in output.
  if (existingDirs.includes("scripts")) {
    const scriptFiles = readScriptFiles(resolvePath(dir, "scripts"));
    const scriptHits = scanScriptSecurity(scriptFiles);
    if (scriptHits.length === 0) {
      heurFindings.push({
        id: `heur-${pad(hIdx++)}`,
        tier: "heuristics" as const,
        severity: "pass" as const,
        message: "scripts/ contains no suspicious network-call or secret-prompt patterns",
        fixable: false,
      });
    } else {
      for (const hit of scriptHits) {
        heurFindings.push({
          id: `heur-${pad(hIdx++)}`,
          tier: "heuristics" as const,
          severity: "warning" as const,
          message: hit.detail,
          fixable: false,
        });
      }
    }
  }

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
          code: "E-PRE-004",
          message: "Deep review requires an LLM judge",
        });
      }
      tiers.llm = { available: false, findings: [] };
    } else {
      // Principles go in as an explicit rubric section the judge must enforce
      // (NOT via the platform slot — that's a PLATFORM_CONTEXT lookup key).
      const rubricText = buildPrincipleRubric(principles) || undefined;
      const lint = opts.lintFn ?? lintSkill;
      opts.onProgress?.(`LLM judge (${caps.preferred}) · ${dir}`);
      const result = await lint(model, caps, agentCfg, evalCfg, undefined, rubricText);
      if (result.ok) {
        let lIdx = 1;
        const llmFindings: ReviewFinding[] = result.output.findings.map((f) => ({
          id: `llm-${pad(lIdx++)}`,
          tier: "llm" as const,
          severity: f.severity,
          message: f.finding,
          fixable: false,
        }));

        // Scenario coverage: a second, separate judge pass — buildScenarioPrompt
        // asks a different question (does the skill handle each documented
        // scenario?) than the skill-quality lint above, so it's kept as its
        // own call rather than merged into one prompt.
        const scenarios: Scenario[] = scenarioResult.ok ? scenarioResult.scenarios : [];
        if (scenarios.length > 0) {
          opts.onProgress?.(`Scenario coverage (${caps.preferred}) · ${dir}`);
          const scenarioPrompt = buildScenarioPrompt(scenarios, model.content);
          const scenarioJudge = opts.scenarioLintFn ?? runJudge;
          const scenarioJudgeResult = await scenarioJudge(scenarioPrompt, caps, agentCfg, evalCfg);
          if (scenarioJudgeResult.ok) {
            llmFindings.push(
              ...scenarioJudgeResult.output.findings.map((f) => ({
                id: `llm-${pad(lIdx++)}`,
                tier: "llm" as const,
                severity: f.severity,
                message: f.finding,
                fixable: false,
              }))
            );
          } else if (opts.deep) {
            throw new NetworkError({
              code: "E-NET-002",
              message: `Scenario coverage judge failed: ${scenarioJudgeResult.error}`,
              suggestion: "Re-run, check the judge CLI/API credentials, or drop --deep to review without the LLM tier",
            });
          }
        }

        tiers.llm = {
          available: true,
          method: result.method,
          findings: llmFindings,
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