import { defineCommand } from "citty";
import { ui } from "../out.js";

export default defineCommand({
  meta: {
    name: "judge",
    description: "Evaluate the latest session for a skill (alias for eval --skill)",
  },
  args: {
    path: {
      type: "positional",
      description: "Path to skill directory or skill name",
      required: true,
    },
    format: {
      type: "string",
      alias: "f",
      description: "Output format (json or table)",
      default: "table",
    },
    ci: {
      type: "boolean",
      description: "Exit non-zero if FAIL",
      default: false,
    },
    verbose: {
      type: "boolean",
      alias: "v",
      description: "Show full checklist",
      default: false,
    },
  },

  async run({ args }) {
    // Delegate to eval with --skill
    const evalCmd = await import("./eval.js").then((m) => m.default);
    // Reconstruct argv-like context for the eval command
    const newArgs = {
      ...args,
      skill: args.path,
      session: undefined,
    };
    // @ts-expect-error - citty context shape
    return evalCmd.run?.({ args: newArgs });
  },
});
