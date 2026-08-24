#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import pkg from "../../package.json" with { type: "json" };
import { registerLifecycleHandlers } from "./render/exit.js";
import { topLevelSubCommands } from "./command-tree.js";

registerLifecycleHandlers();

{
  // Install plumbing — not a product command (same early-exit pattern as --capabilities).
  const { parseCompletionArg, buildCompletionScript } = await import("./completion-script.js");
  const shell = parseCompletionArg(process.argv.slice(2));
  if (shell !== null) {
    const result = await buildCompletionScript(shell);
    if (!result.ok) {
      process.stderr.write(result.error + "\n");
      process.exit(1);
    }
    process.stdout.write(result.script);
    process.exit(0);
  }
}

{
  const argv = process.argv.slice(2);
  const { firstCommand, wantsJson, printRootHelp, printRootHelpJson } = await import("./root-help.js");
  const { retiredNext } = await import("./retired.js");
  const first = firstCommand(argv);

  if (first) {
    const next = retiredNext(first);
    if (next) {
      const { ui, nextAction } = await import("./out.js");
      ui.fail(`Unknown command: ${first}`);
      for (const n of Array.isArray(next) ? next : [next]) nextAction(n);
      process.exit(2);
    }
    if (!(first in topLevelSubCommands)) {
      const { ui, nextAction } = await import("./out.js");
      ui.fail(`Unknown command: ${first}`);
      nextAction("dora --help");
      process.exit(1);
    }
  } else if (argv.includes("--capabilities")) {
    const { ui, nextAction } = await import("./out.js");
    ui.fail("Unknown flag: --capabilities");
    nextAction("dora --help --json");
    process.exit(1);
  } else if (!argv.includes("--version") && !argv.includes("-v") && !argv.includes("-V")) {
    if (wantsJson(argv)) printRootHelpJson();
    else printRootHelp();
    process.exit(0);
  }
}

const main = defineCommand({
  meta: {
    name: "doraval",
    version: pkg.version,
    // Multi-line: citty prints this as the help banner (version appended on last line).
    description: [
      "Reads your repo and tells you what's broken in agent context.",
      "",
      "Start here:",
      "  npx skills add saif-shines/doraval",
      "  dora review --quick",
      "",
      "Map: dora --help --json    Docs: https://doraval.dev",
    ].join("\n"),
  },
  subCommands: topLevelSubCommands,
  // Declared so citty's own parser consumes "--format json" / "--format=json"
  // correctly on the bare invocation — without these, an undeclared root flag's
  // value token gets left as a stray positional and misrouted as a subcommand.
  args: {
    format: { type: "string", description: "Output format: table | json", default: "table" },
    json: { type: "boolean", description: "Alias for --format json", default: false },
    ci: { type: "boolean", description: "Machine mode (implies --format json)", default: false },
    cwd: { type: "string", description: "Directory to scan (CI / coding agents)" },
    yes: {
      type: "boolean",
      description: "Skip the scan proceed/stop prompt (agents / scripts)",
      default: false,
      alias: "y",
    },
    completion: {
      type: "string",
      description: "Print shell completion script (bash|zsh|fish) — install plumbing, not a product command",
    },
  },
  async run({ args }) {
    const cliArgs = process.argv.slice(2);
    if (cliArgs.length > 0 && !cliArgs[0]!.startsWith("-")) return; // subcommand provided

    const { printRootHelp, printRootHelpJson, wantsJson } = await import("./root-help.js");
    if (wantsJson(process.argv.slice(2))) printRootHelpJson();
    else printRootHelp();
  },
});

runMain(main);
