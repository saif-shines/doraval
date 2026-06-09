import { defineCommand } from "citty";
import { ui } from "../out.js";

export default defineCommand({
  meta: {
    name: "judge",
    description: "AI-driven qualitative assessment of a skill",
  },
  args: {
    path: {
      type: "positional",
      description: "Path to skill directory",
      required: true,
    },
    for: {
      type: "string",
      description: 'Target a provider ("claude") or specific validator ("claude:skill")',
    },
    format: {
      type: "string",
      alias: "f",
      description: "Output format (json or table)",
      default: "table",
    },
    verbose: {
      type: "boolean",
      alias: "v",
      description: "Show detailed diagnostics",
      default: false,
    },
  },

  async run({ args }) {
    ui.heading("doraval skill judge — AI-driven assessment");
    ui.info(`  Path:  ${args.path}\n`);
    ui.warn(
      "Not yet implemented. This command will send the skill to an LLM for qualitative review (clarity, completeness, effectiveness).\n"
    );
    process.exit(2);
  },
});
