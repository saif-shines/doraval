import { defineCommand } from "citty";
import { ui } from "../../out.js";
import { detectContext } from "./context.js";
import { prompt } from "../../prompt.js";
import { join } from "path";

export type Intent = "self" | "self-later" | "distribute";

export interface Decision {
  path: "standalone" | "plugin";
  targetDir: string;
  shouldCreateDir: boolean;
  migrateExisting: boolean;
}

export function decidePath(ctx: ReturnType<typeof import("./context.js").detectContext>, intent: Intent | undefined, providedName?: string): Decision {
  const name = providedName || "my-skill";
  let path: "standalone" | "plugin" = "standalone";
  let targetDir = ctx.cwd;
  let shouldCreateDir = false;
  let migrateExisting = false;

  if (intent === "distribute" || (intent === "self-later" && ctx.looseSkillFiles.length > 0 && !ctx.hasClaudeDir)) {
    path = "plugin";
    targetDir = join(ctx.cwd, `${name}-plugin`);
    shouldCreateDir = true;
    migrateExisting = ctx.looseSkillFiles.length > 0;
  } else if (intent === "self-later" && !ctx.hasClaudeDir) {
    // Could default to standalone with note, but per spec use plugin sibling for loose case
    path = "plugin";
    targetDir = join(ctx.cwd, `${name}-plugin`);
    shouldCreateDir = true;
  }

  return { path, targetDir, shouldCreateDir, migrateExisting };
}

export default defineCommand({
  meta: {
    name: "new",
    description: "Create a new skill or plugin following Claude Code packaging rules",
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
  run({ args }) {
    ui.heading("doraval claude new — Context-aware scaffolding (stub)");
    const ctx = detectContext();
    let intent: Intent = (args.intent as Intent) || "self-later";
    if (!args.yes) {
      // Simplified prompt for now; full questions later
      const ans = prompt("  Intent (self | self-later | distribute)", intent);
      intent = (ans as Intent) || intent;
    }

    const decision = decidePath(ctx, intent, args.name as string | undefined);

    ui.info(`  Decision: path=${decision.path}, target=${decision.targetDir}`);
    if (decision.shouldCreateDir) {
      // mkdir will happen in scaffolding task
    }
    process.exit(0);
  },
});
