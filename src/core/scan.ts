/**
 * The scan engine behind bare `dora` (plan item B4). Composition only:
 * detection (agent-detect), discovery (skill-discovery), validation
 * (skill-validate + static-skill-checks), intelligence (capability-detect).
 */
import { relative } from "path";
import pkg from "../../package.json" with { type: "json" };
import {
  detectAllAgents,
  scanCrossAgent,
  defaultDeps,
  type AgentDetection,
  type CrossAgentSurface,
  type DetectDeps,
} from "./agent-detect.js";
import { classifySkillDir, type SkillOrigin } from "./skill-classify.js";
import { resolveScanScope, type ScanScope } from "./scan-scope.js";
import { findSkillDirs } from "./skill-discovery.js";
import { loadSkillFromDir, validateSkillModel } from "./skill-validate.js";
import { analyzeDrift } from "./static-skill-checks.js";
import { detectCapabilities } from "./capability-detect.js";
import { readConfig, getEvalConfig } from "./journal-config.js";
import { detectContradictions, type Contradiction } from "./cross-agent.js";

export interface HealthItem {
  text: string;
  hint?: string;
  code?: string;
}

export interface HealthEntry {
  path: string;
  origin: SkillOrigin;
  status: "pass" | "warn" | "fail";
  errors: HealthItem[];
  warnings: HealthItem[];
}

export interface Suggestion {
  kind: "fix" | "improve" | "start";
  title: string;
  command: string;
}

export interface IntelligenceStatus {
  judge: "api" | "cli" | "none";
  detail: string;
}

export interface ScanResult {
  version: string;
  scope: ScanScope;
  agents: AgentDetection[];
  crossAgent: CrossAgentSurface;
  health: HealthEntry[];
  /** B16 — cross-agent config conflicts (empty when none). */
  contradictions: Contradiction[];
  summary: { passed: number; warnings: number; failed: number };
  intelligence: IntelligenceStatus;
  suggestions: Suggestion[];
  empty: boolean;
}

export async function runScan(cwd: string, deps: DetectDeps = defaultDeps): Promise<ScanResult> {
  const scope = resolveScanScope(cwd);
  const agents = detectAllAgents(scope.scanRoot, deps);
  const crossAgent = scanCrossAgent(scope.scanRoot);
  const contradictions = detectContradictions(scope.scanRoot);

  const skillDirs = findSkillDirs(scope.scanRoot);
  const health: HealthEntry[] = [];

  for (const dir of skillDirs) {
    const rel = relative(scope.scanRoot, dir) || ".";
    const origin = classifySkillDir(dir, { cwd: scope.scanRoot });
    const loaded = await loadSkillFromDir(dir);

    if (!loaded.ok) {
      health.push({
        path: rel,
        origin,
        status: "fail",
        errors: [{ text: loaded.error, code: "E-VAL-001" }],
        warnings: [],
      });
      continue;
    }

    const validation = validateSkillModel(loaded.model, { existingDirs: loaded.existingDirs });
    const drift = analyzeDrift({
      description: String(loaded.model.data["description"] ?? ""),
      content: loaded.model.content,
    });
    const heuristicWarnings = drift.drifts
      .filter((d) => d.drifted)
      .map((d) => ({ text: `${d.category}: ${d.detail}` }));

    const errors = validation.errors.map((e) => ({ text: e.text, hint: e.hint, code: e.code }));
    const warnings = [
      ...validation.warnings.map((w) => ({ text: w.text, hint: w.hint, code: w.code })),
      ...heuristicWarnings,
    ];

    health.push({
      path: rel,
      origin,
      status: errors.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
      errors,
      warnings,
    });
  }

  const summary = {
    passed: health.filter((h) => h.status === "pass").length,
    warnings: health.filter((h) => h.status === "warn").length,
    failed: health.filter((h) => h.status === "fail").length,
  };

  // Include config-stored eval credentials, not just env vars
  const cfg = await readConfig().catch(() => null);
  const caps = detectCapabilities(getEvalConfig(cfg));
  const intelligence: IntelligenceStatus =
    caps.preferred === "api"
      ? { judge: "api", detail: "API key detected — deep review ready" }
      : caps.preferred === "cli"
      ? { judge: "cli", detail: `${caps.cliCommand} CLI available as judge — deep review ready` }
      : { judge: "none", detail: "no judge found — install a coding agent CLI or set an API key" };

  const anyAgentConfigured = agents.some((a) => a.configuredInRepo);
  const empty = health.length === 0 && !anyAgentConfigured && !crossAgent.agentsMd && !crossAgent.mcpJson;

  const suggestions: Suggestion[] = [];
  if (empty) {
    suggestions.push({
      kind: "start",
      title: "No agent context found — create your first skill or rule",
      command: "dora new",
    });
  }
  for (const h of health.filter((x) => x.status === "fail")) {
    suggestions.push({
      kind: "fix",
      title: `Fix ${h.path}: ${h.errors[0]?.text ?? "validation error"}`,
      command: `dora fix ${h.path}`,
    });
  }
  if (!empty && intelligence.judge !== "none" && summary.warnings + summary.failed > 0) {
    suggestions.push({
      kind: "improve",
      title: "Deep-check quality with an LLM review",
      command: "dora review --all",
    });
  }
  if (contradictions.some((c) => c.severity === "conflict")) {
    suggestions.push({
      kind: "fix",
      title: `${contradictions.filter((c) => c.severity === "conflict").length} cross-agent contradiction(s)`,
      command: "dora reconcile",
    });
  } else if (contradictions.length > 0) {
    suggestions.push({
      kind: "improve",
      title: `${contradictions.length} cross-agent gap(s) — review coverage`,
      command: "dora reconcile --dry-run",
    });
  }

  return {
    version: pkg.version,
    scope,
    agents,
    crossAgent,
    health,
    contradictions,
    summary,
    intelligence,
    suggestions,
    empty,
  };
}
