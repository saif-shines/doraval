/**
 * The scan engine behind bare `dora` (plan item B4). Composition only:
 * detection (agent-detect), discovery (skill-discovery), validation
 * (skill-check), intelligence (capability-detect).
 */
import { statSync } from "fs";
import { relative, resolve as resolvePath } from "path";
import pkg from "../../package.json" with { type: "json" };
import {
  detectAllAgents,
  scanCrossAgent,
  defaultDeps,
  type AgentDetection,
  type CrossAgentSurface,
  type DetectDeps,
} from "./agent-detect.js";
import { pluginRoot, type SkillOrigin } from "./skill-classify.js";
import { resolveScanScope, type ScanScope } from "./scan-scope.js";
import { findSkillDirs } from "./skill-discovery.js";
import { detectSkillShadows, shadowWarningText, type SkillShadow } from "./skill-shadow.js";
import { checkSkill } from "./skill-check.js";
import { loadRecentSessions, collectSessionEvidence, type LoadResult } from "./session-evidence.js";
import type { Finding } from "./finding.js";
import { detectCapabilities } from "./capability-detect.js";
import { readConfig, getEvalConfig } from "./journal-config.js";
import { detectContradictions, type Contradiction } from "./cross-agent.js";
import { planPromote } from "./memory-promote.js";
import {
  checkPlatformInstall,
  type PlatformInstallCheck,
  type PlatformInstallDeps,
} from "./platform-install.js";
import { measureContextBudget, listMcpServerNames, type ContextBudget } from "./context-budget.js";
import {
  detectSkillOverlaps,
  detectMcpNameCollisions,
  overlapWarningText,
  type SkillOverlap,
  type McpNameCollision,
  type SkillOverlapInput,
} from "./skill-overlap.js";
import { withDocUrl } from "./doc-registry.js";
import { resolveEffectiveRules } from "./rules/resolve.js";


function healthItem(item: HealthItem): HealthItem {
  return withDocUrl(item);
}

function findingToHealth(f: Finding): HealthItem {
  return healthItem({
    text: f.message,
    ...(f.hint ? { hint: f.hint } : {}),
    ...(f.code ? { code: f.code } : {}),
    ...(f.docUrl ? { docUrl: f.docUrl } : {}),
  });
}

export interface HealthItem {
  text: string;
  hint?: string;
  code?: string;
  docUrl?: string;
}

export interface HealthEntry {
  path: string;
  origin: SkillOrigin;
  status: "pass" | "warn" | "fail";
  errors: HealthItem[];
  warnings: HealthItem[];
  pluginOwned?: boolean;
  pluginRoot?: string;
}

export interface Suggestion {
  kind: "fix" | "improve" | "start";
  title: string;
  command: string;
}

export interface IntelligenceStatus {
  judge: "api" | "delegate";
  detail: string;
  /** B-xi — this host's platform optionalDep / binary health */
  install: PlatformInstallCheck;
  /** Always-on context budget (CLAUDE.md / AGENTS.md / rules / MCP inventory) */
  contextBudget: ContextBudget;
}

export interface ScanResult {
  version: string;
  scope: ScanScope;
  agents: AgentDetection[];
  crossAgent: CrossAgentSurface;
  health: HealthEntry[];
  /** B16 — cross-agent config conflicts (empty when none). */
  contradictions: Contradiction[];
  /** B-viii — same skill leaf-name under multiple agent roots (winner first). */
  shadows: SkillShadow[];
  /** Skills with different names but competing descriptions (selection ambiguity). */
  overlaps: SkillOverlap[];
  /** MCP servers that look like near-duplicates by name. */
  mcpCollisions: McpNameCollision[];
  summary: { passed: number; warnings: number; failed: number };
  intelligence: IntelligenceStatus;
  suggestions: Suggestion[];
  empty: boolean;
}

export async function runScan(
  cwd: string,
  deps: DetectDeps = defaultDeps,
  opts?: { installDeps?: Partial<PlatformInstallDeps>; loadedSessions?: LoadResult },
): Promise<ScanResult> {
  const scope = resolveScanScope(cwd);
  const agents = detectAllAgents(scope.scanRoot, deps);
  const crossAgent = scanCrossAgent(scope.scanRoot);
  const contradictions = detectContradictions(scope.scanRoot);

  // Same rules seam as review — packages/overrides gate scan health too.
  const cfg = await readConfig().catch(() => null);
  const { map: effective } = resolveEffectiveRules(cfg, scope.scanRoot);

  const skillDirs = findSkillDirs(scope.scanRoot);
  const health: HealthEntry[] = [];
  const overlapInputs: SkillOverlapInput[] = [];

  for (const dir of skillDirs) {
    const rel = (relative(scope.scanRoot, dir) || ".").replace(/\\/g, "/");
    const checked = await checkSkill(dir, effective, { cwd: scope.scanRoot });
    const origin = checked.origin;
    const errors = checked.findings.filter((f) => f.severity === "error").map(findingToHealth);
    const warnings = checked.findings.filter((f) => f.severity === "warning").map(findingToHealth);

    if (checked.model) {
      const description = [
        String(checked.model.data["description"] ?? ""),
        String(checked.model.data["when_to_use"] ?? ""),
      ]
        .filter((s) => s.trim())
        .join(" ");
      overlapInputs.push({
        path: rel,
        name: String(checked.model.data["name"] ?? rel.split("/").pop() ?? ""),
        description,
      });
    }

    const ownedRoot = pluginRoot(dir, scope.scanRoot);
    health.push({
      path: rel,
      origin,
      status: errors.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
      errors,
      warnings,
      ...(ownedRoot ? { pluginOwned: true, pluginRoot: ownedRoot } : {}),
    });
  }

  // Name collisions across agent roots (e.g. .grok/skills/x vs .claude/skills/x)
  const shadows = detectSkillShadows(health.map((h) => h.path));
  for (const shadow of shadows) {
    for (const p of shadow.paths) {
      const entry = health.find((h) => h.path.replace(/\\/g, "/") === p);
      if (!entry) continue;
      entry.warnings.push(
        healthItem({
          text: shadowWarningText(shadow, p),
          code: "E-SCAN-SHADOW",
        }),
      );
      if (entry.status === "pass") entry.status = "warn";
    }
  }

  // Competing descriptions (different names, same job)
  const overlaps = detectSkillOverlaps(overlapInputs);
  for (const o of overlaps) {
    for (const p of [o.a, o.b]) {
      const entry = health.find((h) => h.path.replace(/\\/g, "/") === p);
      if (!entry) continue;
      entry.warnings.push(
        healthItem({
          text: overlapWarningText(o, p),
          code: "E-SCAN-OVERLAP",
        }),
      );
      if (entry.status === "pass") entry.status = "warn";
    }
  }

  const mcpCollisions = detectMcpNameCollisions(listMcpServerNames(scope.scanRoot));

  const loadedSess = opts?.loadedSessions ?? loadRecentSessions(scope.scanRoot);
  if (loadedSess.adaptersDetected.length > 0 && effective.get("R034")?.enabled) {
    for (const dir of skillDirs) {
      const rel = (relative(scope.scanRoot, dir) || ".").replace(/\\/g, "/");
      const entry = health.find((h) => h.path === rel);
      if (!entry) continue;
      const name = overlapInputs.find((o) => o.path === rel)?.name ?? rel.split("/").pop() ?? rel;
      let mtimeMs: number | undefined;
      try { mtimeMs = statSync(resolvePath(dir, "SKILL.md")).mtimeMs; } catch { /* no SKILL.md */ }
      const r034 = collectSessionEvidence(name, dir, loadedSess, {
        required: false,
        origin: entry.origin,
        mtimeMs,
      }).find((f) => f.code === "R034");
      if (!r034) continue;
      entry.warnings.push(findingToHealth(r034));
      if (entry.status === "pass") entry.status = "warn";
    }
  }

  const summary = {
    passed: health.filter((h) => h.status === "pass").length,
    warnings: health.filter((h) => h.status === "warn").length,
    failed: health.filter((h) => h.status === "fail").length,
  };

  // cfg loaded above for rules; reuse for judge credentials
  const caps = detectCapabilities(getEvalConfig(cfg));
  const install = checkPlatformInstall(opts?.installDeps);
  const judgePart =
    caps.preferred === "api"
      ? { judge: "api" as const, detail: "API judge configured — deep review ready" }
      : {
          judge: "delegate" as const,
          detail: "no API key — in-agent runs delegate judging to the caller; --ci needs a key",
        };
  const contextBudget = measureContextBudget(scope.scanRoot, health.length);
  const intelligence: IntelligenceStatus = { ...judgePart, install, contextBudget };

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
  if (install.status === "fail") {
    suggestions.push({
      kind: "fix",
      title: install.detail,
      command: "npm install @hacksmith/doraval",
    });
  } else if (install.status === "warn") {
    suggestions.push({
      kind: "improve",
      title: install.detail,
      command: `npm install @hacksmith/doraval@${install.expectedVersion}`,
    });
  }
  for (const h of health.filter((x) => x.status === "fail")) {
    suggestions.push({
      kind: "fix",
      title: `Fix ${h.path}: ${h.errors[0]?.text ?? "validation error"}`,
      command: `dora fix ${h.path}`,
    });
  }
  if (contextBudget.status === "warn" && contextBudget.hint) {
    const largest = contextBudget.largestAlwaysOn;
    suggestions.push({
      kind: "improve",
      title: contextBudget.hint,
      command: largest ? `dora review ${largest.path}` : "dora scan",
    });
  }
  if (overlaps.length > 0) {
    const top = overlaps[0]!;
    suggestions.push({
      kind: "improve",
      title: `${overlaps.length} skill description overlap(s) — agents may pick the wrong skill`,
      command: `dora review ${top.a}`,
    });
  }
  if (mcpCollisions.length > 0) {
    suggestions.push({
      kind: "improve",
      title: mcpCollisions[0]!.reason,
      command: "dora review .mcp.json",
    });
  }
  if (!empty && summary.warnings + summary.failed > 0) {
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

  // High-weight principles not yet in AGENTS.md → promote suggestion (B13a)
  try {
    const promote = planPromote(scope.scanRoot);
    if (!promote.noop && promote.candidates.length > 0) {
      suggestions.push({
        kind: "improve",
        title: `${promote.candidates.length} high-weight principle(s) not in AGENTS.md`,
        command: "dora memory promote",
      });
    }
  } catch {
    // intentional: memory store optional; scan must not fail without it
  }

  const removeCount = health.filter((h) => h.warnings.some((w) => w.code === "R034")).length;
  if (removeCount > 0) {
    suggestions.push({
      kind: "improve",
      title: `${removeCount} Remove candidate${removeCount === 1 ? "" : "s"}`,
      command: "dora skill unused",
    });
  }

  return {
    version: pkg.version,
    scope,
    agents,
    crossAgent,
    health,
    contradictions,
    shadows,
    overlaps,
    mcpCollisions,
    summary,
    intelligence,
    suggestions,
    empty,
  };
}
