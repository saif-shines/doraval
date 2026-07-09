import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  appendFileSync,
} from "fs";
import { join, dirname, basename } from "path";
import { getProviderSpec } from "../providers/spec.js";
import type { ProviderId } from "../providers/types.js";
import {
  type Decision,
  standaloneSkillRel,
  agentRelativePath,
} from "./scaffold-wizard.js";

export interface ScaffoldWriteResult {
  ok: true;
  createdFiles: string[];
  targetDir: string;
  path: Decision["path"];
  name: string;
  provider: ProviderId;
}

export interface ScaffoldWriteError {
  ok: false;
  error: string;
}

export type ScaffoldResult = ScaffoldWriteResult | ScaffoldWriteError;

/**
 * Write scaffold files for a Decision. Pure-ish FS side effects; no UI.
 */
export function writeScaffold(decision: Decision, migrateContent?: string): ScaffoldResult {
  const { targetDir, path, shouldCreateDir, provider, name, description } = decision;

  if (existsSync(targetDir) && shouldCreateDir) {
    return { ok: false, error: `Target already exists: ${targetDir}` };
  }

  if (shouldCreateDir) {
    mkdirSync(targetDir, { recursive: true });
  }

  const created: string[] = [];

  try {
    if (path === "native-rule") {
      created.push(...writeRule(decision));
    } else if (path === "native-agent") {
      created.push(...writeAgent(decision));
    } else if (path === "plugin") {
      created.push(...writePlugin(decision, migrateContent));
    } else {
      created.push(...writeStandaloneSkill(decision, migrateContent));
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  return {
    ok: true,
    createdFiles: created,
    targetDir,
    path,
    name,
    provider,
  };
}

// ── Skill body ─────────────────────────────────────────────────────

function defaultSkillMd(skillName: string, description: string, provider: ProviderId): string {
  return `---
name: ${skillName}
description: ${description}
---

# ${titleCase(skillName)}

${description}

When you need to check a skill or plugin:

- Scan the current directory: \`dora\`
- Review one skill: \`dora review ./skills/${skillName}/\`
- Apply mechanical fixes: \`dora fix ./skills/${skillName}/\`
- Get an AI quality judgment: \`dora review --deep ./skills/${skillName}/\`

Always run \`dora review\` before sharing or publishing.

Provider target: **${provider}**.
`;
}

// ── Plugin ─────────────────────────────────────────────────────────

function writePlugin(decision: Decision, migrateContent?: string): string[] {
  const { targetDir, provider, description } = decision;
  const pluginName = basename(targetDir);
  const spec = getProviderSpec(provider);
  const created: string[] = [];

  const pluginJson = buildPluginJson(provider, pluginName, description);
  const manifestAbs = join(targetDir, spec.manifestPath);
  mkdirSync(dirname(manifestAbs), { recursive: true });
  writeFileSync(manifestAbs, JSON.stringify(pluginJson, null, 2));
  created.push(spec.manifestPath);

  const marketplaceAbs = join(targetDir, spec.marketplacePath);
  mkdirSync(dirname(marketplaceAbs), { recursive: true });
  writeFileSync(marketplaceAbs, JSON.stringify(buildMarketplaceJson(provider, pluginName, description), null, 2));
  created.push(spec.marketplacePath);

  const demoSkillName = "doraval";
  const skillRel = join("skills", demoSkillName, "SKILL.md");
  const skillAbs = join(targetDir, skillRel);
  mkdirSync(dirname(skillAbs), { recursive: true });
  const skillContent =
    migrateContent ||
    defaultSkillMd(
      demoSkillName,
      "Use doraval to review and fix agent context artifacts.",
      provider,
    );
  writeFileSync(skillAbs, skillContent);
  created.push(skillRel);

  const readmePath = join(targetDir, "README.md");
  if (!existsSync(readmePath)) {
    writeFileSync(
      readmePath,
      `# ${pluginName}\n\n${provider} plugin scaffolded by doraval.\n`,
    );
    created.push("README.md");
  }

  return created;
}

function buildPluginJson(provider: ProviderId, name: string, description: string): Record<string, unknown> {
  const base: Record<string, unknown> = {
    name,
    version: "0.1.0",
    description,
    keywords: ["example-keyword", "another-keyword"],
  };

  switch (provider) {
    case "claude":
      return base;
    case "codex":
      return {
        ...base,
        skills: "./skills/",
        interface: {
          displayName: name,
          shortDescription: description.slice(0, 80),
          category: "Productivity",
        },
      };
    case "cursor":
      return {
        ...base,
        skills: "./skills/",
        displayName: name,
      };
    case "copilot":
      return {
        ...base,
        skills: ["./skills/"],
      };
    default:
      return { ...base, skills: "./skills/" };
  }
}

function buildMarketplaceJson(
  provider: ProviderId,
  pluginName: string,
  description: string,
): Record<string, unknown> {
  if (provider === "codex") {
    return {
      name: "local",
      interface: { displayName: "Local (doraval scaffold)" },
      plugins: [
        {
          name: pluginName,
          source: { source: "local", path: "../.." },
          policy: {
            installation: "AVAILABLE",
            authentication: "ON_INSTALL",
          },
          category: "Productivity",
        },
      ],
    };
  }

  if (provider === "claude") {
    // Claude historically wrote marketplace.json at plugin root
    return {
      name: pluginName,
      version: "0.1.0",
      description,
      author: { name: "" },
      homepage: "",
      repository: "",
      license: "MIT",
      keywords: ["claude-code", "skills", "plugin"],
    };
  }

  return {
    name: pluginName,
    version: "0.1.0",
    description,
    author: { name: "" },
    homepage: "",
    repository: "",
    license: "MIT",
    keywords: [provider, "skills", "plugin"],
  };
}

// ── Standalone skill ───────────────────────────────────────────────

function writeStandaloneSkill(decision: Decision, migrateContent?: string): string[] {
  const { targetDir, provider, name, description } = decision;
  const rel = standaloneSkillRel(provider, name);
  const abs = join(targetDir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  const body = migrateContent
    ? migrateContent.startsWith("---")
      ? migrateContent
      : `---\nname: ${name}\ndescription: ${description}\n---\n\n${migrateContent}`
    : defaultSkillMd(name, description, provider);
  writeFileSync(abs, body);
  return [rel];
}

// ── Rule ───────────────────────────────────────────────────────────

function writeRule(decision: Decision): string[] {
  const target = decision.ruleTarget!;
  const abs = join(decision.targetDir, target.file);
  mkdirSync(dirname(abs), { recursive: true });

  const section = `## ${titleCase(decision.name)}\n\n${decision.description}\n`;

  if (target.kind === "cursor-rule") {
    const body = `---\ndescription: ${decision.description}\nglobs:\nalwaysApply: true\n---\n\n# ${titleCase(decision.name)}\n\n${decision.description}\n`;
    writeFileSync(abs, body);
    return [target.file];
  }

  // Section append into AGENTS.md / CLAUDE.md / copilot-instructions
  if (existsSync(abs)) {
    const existing = readFileSync(abs, "utf-8");
    if (existing.includes(`## ${titleCase(decision.name)}`)) {
      return [target.file]; // already present
    }
    appendFileSync(abs, `\n${section}`);
  } else {
    const header =
      target.kind === "agents-md"
        ? "# Agent instructions\n\n"
        : target.kind === "claude-md"
          ? "# Project instructions\n\n"
          : "# Copilot instructions\n\n";
    writeFileSync(abs, header + section);
  }
  return [target.file];
}

// ── Agent (subagent) ───────────────────────────────────────────────

function writeAgent(decision: Decision): string[] {
  const rel = agentRelativePath(decision.provider, decision.name);
  const abs = join(decision.targetDir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  const body = `---
name: ${decision.name}
description: ${decision.description}
tools: Read, Grep, Glob
---

# ${titleCase(decision.name)}

${decision.description}

You are a focused subagent. Stay within your role; prefer read-only tools unless the user asks you to edit.
`;
  writeFileSync(abs, body);
  return [rel];
}

function titleCase(s: string): string {
  return s
    .split("-")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}
