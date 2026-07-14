import { defineCommand } from "citty";
import pc from "picocolors";
import { basename } from "path";
import {
  decidePath,
  detectScaffoldContext,
  parseProviderId,
  parseScaffoldType,
  SCAFFOLD_PROVIDERS,
  SCAFFOLD_TYPES,
  SCAFFOLD_TYPE_HINTS,
  SCAFFOLD_INTENT_HINTS,
  type Intent,
  type ScaffoldType,
} from "../../core/scaffold-wizard.js";
import { writeScaffold } from "../../core/scaffold.js";
import { promptSelect, prompt } from "../prompt.js";
import { ui, resolveOutputMode, outJson, emitError, summaryLine } from "../out.js";
import { exit } from "../render/exit.js";
import type { ProviderId } from "../../providers/types.js";

const TYPE_HELP =
  "skill = reusable SKILL.md · rule = always-on convention · agent = subagent role · plugin = package to ship";

export default defineCommand({
  meta: {
    name: "new",
    description: "Scaffold a skill, rule, agent, or plugin for a coding agent",
  },
  args: {
    type: {
      type: "positional",
      description: `skill | rule | agent | plugin — ${TYPE_HELP}`,
      required: false,
    },
    name: {
      type: "positional",
      description: "Name of the skill/rule/agent/plugin",
      required: false,
    },
    for: {
      type: "string",
      description: "Target agent: claude | cursor | codex | copilot",
      alias: "f",
    },
    description: {
      type: "string",
      description: "Short description",
      alias: "d",
    },
    intent: {
      type: "string",
      description: 'Intent: "self" | "self-later" | "distribute"',
    },
    native: {
      type: "boolean",
      description: "Scaffold the agent's native format (not plugin packaging)",
      default: false,
    },
    yes: {
      type: "boolean",
      description: "Skip interactive prompts (use defaults and flags)",
      default: false,
      alias: "y",
    },
    format: {
      type: "string",
      description: "Output format: table | json",
      default: "table",
    },
    ci: {
      type: "boolean",
      description: "Machine mode (implies --format json)",
      default: false,
    },
    cwd: {
      type: "string",
      description: "Working directory override",
    },
  },
  async run({ args }) {
    const mode = resolveOutputMode({ format: args.format as string, ci: args.ci as boolean });
    const cwd = args.cwd ? String(args.cwd) : process.cwd();
    const yes = Boolean(args.yes);

    try {
      // ── type ──────────────────────────────────────────────────
      let type = parseScaffoldType(args.type as string | undefined);
      if (!type && !yes) {
        type = await promptSelect<ScaffoldType>(
          "What do you want to create?",
          SCAFFOLD_TYPES.map((t) => ({
            value: t,
            label: t,
            hint: SCAFFOLD_TYPE_HINTS[t],
          })),
          "skill",
        );
      }
      if (!type) {
        // --yes with no type defaults to skill
        type = "skill";
      }

      // ── provider ──────────────────────────────────────────────
      let provider = parseProviderId(args.for as string | undefined);
      if (!provider && !yes) {
        provider = await promptSelect<ProviderId>(
          "Which agent is this for?",
          SCAFFOLD_PROVIDERS.map((p) => ({ value: p, label: p })),
          "claude",
        );
      }
      if (!provider) provider = "claude";

      // ── intent ────────────────────────────────────────────────
      let intent: Intent = (args.intent as Intent) || "self-later";
      if (args.intent) {
        const i = String(args.intent);
        if (i !== "self" && i !== "self-later" && i !== "distribute") {
          throw new Error(`Invalid --intent "${i}". Use self | self-later | distribute.`);
        }
        intent = i;
      } else if (!yes && (type === "skill" || type === "plugin")) {
        intent = await promptSelect<Intent>(
          "Intent",
          (["self", "self-later", "distribute"] as const).map((i) => ({
            value: i,
            label: i,
            hint: SCAFFOLD_INTENT_HINTS[i],
          })),
          "self-later",
        );
      }
      if (type === "plugin" && intent === "self") {
        // plugin type implies packaging
        intent = "distribute";
      }

      // ── name + description ─────────────────────────────────────
      let name = args.name ? String(args.name) : undefined;
      if (!name && !yes) {
        name = await prompt("Name", type === "plugin" ? "my-plugin" : type === "rule" ? "project-conventions" : type === "agent" ? "helper" : "my-skill");
      }

      let description = args.description ? String(args.description) : undefined;
      if (!description && !yes) {
        description = await prompt("Description", "Scaffolded by doraval");
      }

      const native = Boolean(args.native);
      const ctx = detectScaffoldContext(cwd, provider);
      const decision = decidePath({
        type,
        provider,
        intent,
        name,
        description,
        native,
        cwd,
        ctx,
      });

      // Outcome preview before write (table mode) — B35
      if (mode.format !== "json") {
        ui.dim(`  Will create: ${decision.primaryPath}`);
        if (decision.targetDir && decision.targetDir !== decision.primaryPath) {
          ui.dim(`  target dir: ${decision.targetDir}`);
        }
      }

      const result = writeScaffold(decision);
      if (!result.ok) {
        throw new Error(result.error);
      }

      if (mode.format === "json") {
        outJson({
          type: decision.type,
          path: decision.path,
          provider: decision.provider,
          name: decision.name,
          targetDir: result.targetDir,
          createdFiles: result.createdFiles,
          primaryPath: decision.primaryPath,
        });
        await exit(0);
        return;
      }

      ui.blank();
      ui.success(`Created ${decision.type} (${decision.path}) for ${decision.provider}`);
      ui.write(`  name:   ${pc.bold(decision.name)}`);
      ui.write(`  target: ${result.targetDir}`);
      for (const f of result.createdFiles) {
        ui.write(`  + ${f}`);
      }
      ui.blank();
      ui.write(`  ${pc.white("Next:")} ${pc.dim(`dora review ${decision.path === "plugin" ? result.targetDir : decision.primaryPath}`)}`);
      if (decision.path === "plugin") {
        ui.write(`  ${pc.dim(`Manifest: ${decision.primaryPath}`)}`);
      }
      ui.blank();
      summaryLine(`${decision.type} · ${decision.provider} · ${basename(result.targetDir)}`);
      await exit(0);
    } catch (e) {
      emitError(e, mode);
      await exit(2);
    }
  },
});
