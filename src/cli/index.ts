#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import pkg from "../../package.json" with { type: "json" };
import { registerLifecycleHandlers } from "./render/exit.js";
import { topLevelSubCommands } from "./command-tree.js";

registerLifecycleHandlers();

const main = defineCommand({
  meta: {
    name: "doraval",
    version: pkg.version,
    description:
      "Reads your repo and tells you what's broken, missing, or contradictory in your agent context — for every coding agent you use.",
  },
  subCommands: topLevelSubCommands,
  async run() {
    const cliArgs = process.argv.slice(2);
    if (cliArgs.length > 0 && !cliArgs[0]!.startsWith("-")) return; // subcommand provided

    // Bare `dora` (possibly with flags like --format json) → the scan IS the product.
    const scan = await import("./commands/scan.js").then((m) => m.default);
    await scan.run!({
      args: {
        format: cliArgs.includes("--format")
          ? cliArgs[cliArgs.indexOf("--format") + 1] ?? "table"
          : cliArgs.includes("--ci") ? "json" : "table",
        ci: cliArgs.includes("--ci"),
        cwd: cliArgs.includes("--cwd") ? cliArgs[cliArgs.indexOf("--cwd") + 1] : undefined,
      },
    } as never);
  },
});

runMain(main);
