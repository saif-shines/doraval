import { defineCommand } from "citty";
import { ui } from "../../out.js";
import { detectContext } from "./context.js";

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
    ui.info("  This is a stub. Full wizard coming in later tasks.");
    if (args.yes) {
      ui.info("  Non-interactive mode requested.");
    }
    const ctx = detectContext();
    ui.info(`  Context: empty=${ctx.isEmpty}, looseSkills=${ctx.looseSkillFiles.length}`);
    process.exit(0);
  },
});
