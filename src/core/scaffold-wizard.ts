import { existsSync, readdirSync } from "fs";
import { join, basename } from "path";
import type { ProviderId } from "../providers/types.js";
import { getProviderSpec } from "../providers/spec.js";

// ── Types ──────────────────────────────────────────────────────────

export type Intent = "self" | "self-later" | "distribute";
export type ScaffoldType = "skill" | "rule" | "agent" | "plugin";

export interface ScaffoldContext {
  cwd: string;
  hasPluginManifest: boolean;
  hasAgentDir: boolean;
  looseSkillFiles: string[];
  isEmpty: boolean;
  agentSurfaceCount: number;
  hasAgentsMd: boolean;
  hasClaudeMd: boolean;
  hasCursorRules: boolean;
  hasCopilotInstructions: boolean;
}

export interface Decision {
  type: ScaffoldType;
  path: "standalone" | "plugin" | "native-rule" | "native-agent";
  targetDir: string;
  shouldCreateDir: boolean;
  migrateExisting: boolean;
  name: string;
  provider: ProviderId;
  native: boolean;
  description: string;
  intent: Intent;
  primaryPath: string;
  ruleTarget?: RuleTarget;
}

export type RuleTarget =
  | { kind: "agents-md"; file: "AGENTS.md"; section: boolean }
  | { kind: "claude-md"; file: "CLAUDE.md"; section: boolean }
  | { kind: "cursor-rule"; file: string }
  | { kind: "copilot-instructions"; file: ".github/copilot-instructions.md"; section: boolean };

export const SCAFFOLD_PROVIDERS: ProviderId[] = ["claude", "codex", "cursor", "copilot"];
export const SCAFFOLD_TYPES: ScaffoldType[] = ["skill", "rule", "agent", "plugin"];

// ── Context ────────────────────────────────────────────────────────

export function detectScaffoldContext(
  cwd: string = process.cwd(),
  provider: ProviderId = "claude",
): ScaffoldContext {
  const spec = getProviderSpec(provider);
  const hasPluginManifest = existsSync(join(cwd, spec.manifestPath));
  const hasAgentDir =
    existsSync(join(cwd, ".claude")) ||
    existsSync(join(cwd, ".cursor")) ||
    existsSync(join(cwd, ".codex-plugin")) ||
    existsSync(join(cwd, ".github", "plugin"));

  let looseSkillFiles: string[] = [];
  try {
    const files = readdirSync(cwd);
    looseSkillFiles = files.filter((f) => {
      if (!f.endsWith(".md") || f.startsWith(".")) return false;
      const lower = f.toLowerCase();
      if (
        lower === "readme.md" ||
        lower === "changelog.md" ||
        lower === "license.md" ||
        lower.includes("contributing")
      ) {
        return false;
      }
      return lower.includes("skill") || lower === "skill.md";
    });
  } catch {
    /* ignore */
  }

  const hasAgentsMd = existsSync(join(cwd, "AGENTS.md"));
  const hasClaudeMd = existsSync(join(cwd, "CLAUDE.md"));
  const hasCursorRules = existsSync(join(cwd, ".cursor", "rules"));
  const hasCopilotInstructions = existsSync(join(cwd, ".github", "copilot-instructions.md"));

  let agentSurfaceCount = 0;
  if (existsSync(join(cwd, ".claude")) || existsSync(join(cwd, ".claude-plugin"))) agentSurfaceCount++;
  if (existsSync(join(cwd, ".cursor")) || existsSync(join(cwd, ".cursor-plugin"))) agentSurfaceCount++;
  if (existsSync(join(cwd, ".codex-plugin")) || existsSync(join(cwd, ".agents"))) agentSurfaceCount++;
  if (existsSync(join(cwd, ".github", "plugin")) || hasCopilotInstructions) agentSurfaceCount++;

  const isEmpty =
    !hasPluginManifest &&
    !hasAgentDir &&
    looseSkillFiles.length === 0 &&
    !hasAgentsMd &&
    !hasClaudeMd;

  return {
    cwd,
    hasPluginManifest,
    hasAgentDir,
    looseSkillFiles,
    isEmpty,
    agentSurfaceCount,
    hasAgentsMd,
    hasClaudeMd,
    hasCursorRules,
    hasCopilotInstructions,
  };
}

/**
 * Where a rule should live. Existing AGENTS.md always wins; multi-agent repos
 * prefer AGENTS.md; single-agent repos use that agent's native file.
 */
export function recommendConfigTarget(
  ctx: ScaffoldContext,
  provider: ProviderId,
  ruleName: string,
): RuleTarget {
  if (ctx.hasAgentsMd || ctx.agentSurfaceCount >= 2) {
    return { kind: "agents-md", file: "AGENTS.md", section: true };
  }
  if (provider === "claude") {
    return { kind: "claude-md", file: "CLAUDE.md", section: true };
  }
  if (provider === "cursor") {
    return { kind: "cursor-rule", file: `.cursor/rules/${sanitizeName(ruleName)}.md` };
  }
  if (provider === "copilot") {
    return {
      kind: "copilot-instructions",
      file: ".github/copilot-instructions.md",
      section: true,
    };
  }
  return { kind: "agents-md", file: "AGENTS.md", section: true };
}

export function sanitizeName(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "untitled";
}

export function parseProviderId(raw: string | undefined): ProviderId | null {
  if (!raw) return null;
  const id = raw.trim().toLowerCase();
  if ((SCAFFOLD_PROVIDERS as string[]).includes(id)) return id as ProviderId;
  return null;
}

export function parseScaffoldType(raw: string | undefined): ScaffoldType | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if ((SCAFFOLD_TYPES as string[]).includes(t)) return t as ScaffoldType;
  return null;
}

// ── decidePath (shared; same rules as former per-provider new.ts) ──

export interface DecidePathInput {
  type: ScaffoldType;
  provider: ProviderId;
  intent: Intent;
  name?: string;
  description?: string;
  native?: boolean;
  cwd?: string;
  ctx?: ScaffoldContext;
}

export function decidePath(input: DecidePathInput): Decision {
  const cwd = input.cwd ?? process.cwd();
  const ctx = input.ctx ?? detectScaffoldContext(cwd, input.provider);
  const intent = input.intent;
  const native = Boolean(input.native);
  const description = (input.description ?? "").trim() || "Scaffolded by doraval";
  const providedName = (input.name ?? "").trim();

  if (native && intent === "distribute") {
    throw new Error(
      "--native conflicts with --intent distribute. Native scaffolds are for local agent formats; drop --native to build a distributable plugin.",
    );
  }

  if (input.type === "rule") {
    const name = sanitizeName(providedName || "project-conventions");
    const ruleTarget = recommendConfigTarget(ctx, input.provider, name);
    return {
      type: "rule",
      path: "native-rule",
      targetDir: cwd,
      shouldCreateDir: false,
      migrateExisting: false,
      name,
      provider: input.provider,
      native: true,
      description,
      intent,
      primaryPath: join(cwd, ruleTarget.file),
      ruleTarget,
    };
  }

  if (input.type === "agent") {
    const name = sanitizeName(providedName || "helper");
    const rel = agentRelativePath(input.provider, name);
    return {
      type: "agent",
      path: "native-agent",
      targetDir: cwd,
      shouldCreateDir: false,
      migrateExisting: false,
      name,
      provider: input.provider,
      native: true,
      description,
      intent,
      primaryPath: join(cwd, rel),
    };
  }

  // skill | plugin — legacy decidePath logic (identical across providers)
  const forcePlugin = input.type === "plugin";
  const rawName = providedName;
  let decisionPath: "standalone" | "plugin" = forcePlugin ? "plugin" : "standalone";
  let targetDir = cwd;
  let shouldCreateDir = false;
  let migrateExisting = false;

  const useCurrentDirAsRoot =
    rawName === "." || rawName === basename(cwd) || !rawName;

  if (native && input.type === "skill") {
    decisionPath = "standalone";
  } else if (
    forcePlugin ||
    intent === "distribute" ||
    (intent === "self-later" && ctx.looseSkillFiles.length > 0 && !ctx.hasPluginManifest)
  ) {
    decisionPath = "plugin";
    if (useCurrentDirAsRoot) {
      targetDir = cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join(cwd, rawName);
      shouldCreateDir = true;
    }
    migrateExisting = ctx.looseSkillFiles.length > 0;
  } else if (intent === "self-later" && !ctx.hasPluginManifest) {
    decisionPath = "plugin";
    if (useCurrentDirAsRoot) {
      targetDir = cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join(cwd, rawName);
      shouldCreateDir = true;
    }
  } else {
    // standalone skill: always in cwd; `name` is the skill id, not a new project dir
    decisionPath = "standalone";
    targetDir = cwd;
    shouldCreateDir = false;
  }

  // Named plugin dir: when distribute + name, always create subdir (legacy tests)
  if (decisionPath === "plugin" && rawName && rawName !== "." && rawName !== basename(cwd)) {
    targetDir = join(cwd, rawName);
    shouldCreateDir = true;
  }

  const skillName =
    decisionPath === "standalone"
      ? sanitizeName(providedName || (input.provider === "claude" ? "my-skill" : "doraval"))
      : "doraval";
  const pluginName = sanitizeName(basename(targetDir) || "my-plugin");
  const name = decisionPath === "plugin" ? pluginName : skillName;

  const primaryPath =
    decisionPath === "plugin"
      ? join(targetDir, getProviderSpec(input.provider).manifestPath)
      : join(targetDir, standaloneSkillRel(input.provider, skillName));

  return {
    type: input.type === "plugin" ? "plugin" : "skill",
    path: decisionPath,
    targetDir,
    shouldCreateDir,
    migrateExisting,
    name,
    provider: input.provider,
    native,
    description,
    intent,
    primaryPath,
  };
}

export function standaloneSkillRel(provider: ProviderId, skillName: string): string {
  if (provider === "claude") {
    return join(".claude", "skills", skillName, "SKILL.md");
  }
  return join("skills", skillName, "SKILL.md");
}

export function agentRelativePath(provider: ProviderId, agentName: string): string {
  switch (provider) {
    case "claude":
      return join(".claude", "agents", `${agentName}.md`);
    case "cursor":
      return join(".cursor", "agents", `${agentName}.md`);
    case "codex":
      return join(".codex", "agents", `${agentName}.md`);
    case "copilot":
      return join(".github", "agents", `${agentName}.md`);
    default:
      return join("agents", `${agentName}.md`);
  }
}
