/**
 * Thin wrapper — prefer `dora new --for cursor`.
 * Kept so existing `dora cursor new` invocations and tests keep working
 * while B12 migrates the world to the unified command.
 */
import { defineCommand } from "citty";
import pc from "picocolors";
import { basename } from "path";
import { ui } from "../../out.js";
import { promptSelect } from "../../prompt.js";
import { exit } from "../../render/exit.js";
import {
  decidePath,
  detectScaffoldContext,
  type Intent,
} from "../../../core/scaffold-wizard.js";
import { writeScaffold } from "../../../core/scaffold.js";
import { getProviderSpec } from "../../../providers/spec.js";

export type { Intent } from "../../../core/scaffold-wizard.js";
export { decidePath } from "../../../core/scaffold-wizard.js";

/** @deprecated Use writeScaffold from core/scaffold.js */
export async function scaffold(
  decision: ReturnType<typeof decidePath>,
  _ctx?: unknown,
  migrateContent?: string,
) {
  const result = writeScaffold(decision, migrateContent);
  if (!result.ok) {
    ui.fail(result.error);
    return await exit(1);
  }
}

export default defineCommand({
  meta: {
    name: "new",
    description: `Create a new skill or plugin for cursor (prefer: dora new --for cursor)`,
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
    ui.heading(`doraval cursor new — use \`dora new --for cursor\` going forward`);
    const cwd = process.cwd();
    const ctx = detectScaffoldContext(cwd, "cursor");
    let intent: Intent = (args.intent as Intent) || "self-later";
    if (!args.yes) {
      intent = await promptSelect<Intent>(
        "Intent",
        [
          { value: "self", label: "self", hint: "use in this repo now" },
          { value: "self-later", label: "self-later", hint: "personal now, promote later" },
          { value: "distribute", label: "distribute", hint: "ship to others" },
        ],
        intent,
      );
    }

    const decision = decidePath({
      type: "skill",
      provider: "cursor",
      intent,
      name: args.name as string | undefined,
      cwd,
      ctx,
    });

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
      const spec = getProviderSpec("cursor");
      ui.info(`  Manifest: ${spec.manifestPath}`);
      ui.info(`  Marketplace: ${spec.marketplacePath}`);
    }
    ui.info(`  Review: dora review ${decision.targetDir}`);
    ui.info(`  Prefer: dora new skill --for cursor --yes`);
    await exit(0);
  },
});
