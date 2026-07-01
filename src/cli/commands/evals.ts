import { defineCommand, showUsage } from "citty";

/**
 * `dora evals` is dual-purpose:
 *   - `dora evals setup`     → configure judge LLM (vendor/model)
 *   - `dora evals <path> …`  → alias for `dora judge` / `dora eval`
 *
 * Citty treats the first token as a subcommand when `subCommands` is set, so
 * `dora evals .` was rejected as "Unknown command .". We avoid that by routing
 * in `run` instead: path `setup` dispatches to the setup wizard; anything else
 * (including `.`) is forwarded to judge.
 */
export default defineCommand({
  meta: {
    name: "evals",
    description:
      "Judge a skill artifact (alias for judge/eval), or run `evals setup` to configure the judge LLM",
  },
  args: {
    path: {
      type: "positional",
      description: 'Skill directory, or "setup" to configure the judge LLM',
      required: false,
    },
    rubric: {
      type: "string",
      description: "Path to custom best-practices markdown file",
    },
    for: {
      type: "string",
      description: 'Platform rubric: "claude" | "codex" | "cursor" | "copilot" (default: claude)',
      default: "claude",
    },
    format: {
      type: "string",
      alias: "f",
      description: "Output format: table (default) | json",
      default: "table",
    },
    ci: {
      type: "boolean",
      description: "Exit 1 if FAIL",
      default: false,
    },
    verbose: {
      type: "boolean",
      alias: "v",
      description: "Show full checklist",
      default: false,
    },
  },
  async run(ctx) {
    const pathArg = ctx.args.path as string | undefined;

    if (pathArg === "setup") {
      const setup = (await import("./evals/setup.js")).default;
      await setup.run!({ rawArgs: [], args: {}, data: undefined, cmd: setup });
      return;
    }

    if (!pathArg) {
      // Bare `dora evals` — show how both forms work
      showUsage(ctx.cmd);
      return;
    }

    const judge = (await import("./judge.js")).default;
    await judge.run!({
      rawArgs: ctx.rawArgs,
      args: ctx.args,
      data: undefined,
      cmd: judge,
    });
  },
});
