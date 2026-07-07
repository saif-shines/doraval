#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import pkg from "../../package.json" with { type: "json" };
import { registerLifecycleHandlers } from "./render/exit.js";
import { topLevelSubCommands } from "./command-tree.js";

registerLifecycleHandlers();

if (process.argv.includes("--capabilities")) {
  const { buildCapabilities } = await import("./capabilities.js");
  process.stdout.write(JSON.stringify(buildCapabilities(), null, 2) + "\n");
  process.exit(0);
}

const main = defineCommand({
  meta: {
    name: "doraval",
    version: pkg.version,
    description:
      "Reads your repo and tells you what's broken, missing, or contradictory in your agent context — for every coding agent you use.",
  },
  subCommands: topLevelSubCommands,
  // Declared so citty's own parser consumes "--format json" / "--format=json"
  // correctly on the bare invocation — without these, an undeclared root flag's
  // value token gets left as a stray positional and misrouted as a subcommand.
  args: {
    format: { type: "string", description: "Output format: table | json", default: "table" },
    ci: { type: "boolean", description: "Machine mode (implies --format json)", default: false },
    cwd: { type: "string", description: "Directory to scan (for CI and coding agents)" },
  },
  async run({ args }) {
    const cliArgs = process.argv.slice(2);
    if (cliArgs.length > 0 && !cliArgs[0]!.startsWith("-")) return; // subcommand provided

    // Bare `dora` (possibly with flags like --format json) → the scan IS the product.
    const scan = await import("./commands/scan.js").then((m) => m.default);
    await scan.run!({ args } as never);
  },
});

runMain(main);
