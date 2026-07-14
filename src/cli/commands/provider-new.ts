/**
 * Shared implementation for dora {claude,codex,cursor,copilot} new (B38).
 * Prefer `dora new --for <agent>` — these wrappers stay for compatibility.
 */
import { defineCommand } from "citty";
import pc from "picocolors";
import { ui } from "../out.js";
import { promptSelect } from "../prompt.js";
import { exit } from "../render/exit.js";
import {
  decidePath,
  detectScaffoldContext,
  SCAFFOLD_INTENT_HINTS,
  type Intent,
} from "../../core/scaffold-wizard.js";
import { writeScaffold } from "../../core/scaffold.js";
import { getProviderSpec } from "../../providers/spec.js";
import type { ProviderId } from "../../providers/types.js";

const INTENTS = (["self", "self-later", "distribute"] as const).map((i) => ({
  value: i,
  label: i,
  hint: SCAFFOLD_INTENT_HINTS[i],
}));

export function createProviderNewCommand(provider: ProviderId) {
  return defineCommand({
    meta: {
      name: "new",
      description: `Create a skill/plugin for ${provider} [advanced — prefer: dora new --for ${provider}]`,
    },
    args: {
      name: {
        type: "positional",
        description: "Optional name for the skill or plugin",
        required: false,
      },
      yes: {
        type: "boolean",
        description: "Skip interactive prompts (use defaults and flags)",
        default: false,
      },
      intent: {
        type: "string",
        description: 'Intent: "self" | "self-later" | "distribute"',
        required: false,
      },
    },
    async run({ args }) {
      ui.heading(
        `doraval ${provider} new — prefer \`dora new --for ${provider}\` (primary path)`,
      );
      const cwd = process.cwd();
      const ctx = detectScaffoldContext(cwd, provider);
      let intent: Intent = (args.intent as Intent) || "self-later";
      if (!args.yes) {
        intent = await promptSelect<Intent>("Intent", INTENTS, intent);
      }

      const decision = decidePath({
        type: "skill",
        provider,
        intent,
        name: args.name as string | undefined,
        cwd,
        ctx,
      });

      ui.dim(`  Will create: ${decision.primaryPath}`);
      ui.info(`  Decision: path=${decision.path}, target=${decision.targetDir}`);

      let migrateContent: string | undefined;
      if (decision.migrateExisting && !args.yes) {
        migrateContent = "Content from your existing SKILL.md (user-confirmed).";
      }

      const result = writeScaffold(decision, migrateContent);
      if (!result.ok) {
        ui.fail(result.error);
        return await exit(1);
      }

      ui.write(`\n  ${pc.green("✓")} Created ${decision.path} at ${pc.bold(decision.targetDir)}`);
      if (decision.path === "plugin") {
        const spec = getProviderSpec(provider);
        ui.info(`  Manifest: ${spec.manifestPath}`);
        ui.info(`  Marketplace: ${spec.marketplacePath}`);
      }
      ui.info(`  Review: dora review ${decision.targetDir}`);
      ui.info(`  Prefer: dora new skill --for ${provider} --yes`);
      await exit(0);
    },
  });
}
