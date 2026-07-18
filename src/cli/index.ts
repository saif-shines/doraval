#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import pkg from "../../package.json" with { type: "json" };
import { registerLifecycleHandlers } from "./render/exit.js";
import { topLevelSubCommands } from "./command-tree.js";

registerLifecycleHandlers();

/** True when the user asked for machine JSON on this invocation. */
function wantsJsonFormat(argv: string[]): boolean {
  if (argv.includes("--ci")) return true;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--format=json" || a === "-f=json") return true;
    if ((a === "--format" || a === "-f") && argv[i + 1] === "json") return true;
  }
  return false;
}

if (process.argv.includes("--capabilities")) {
  // B39: human discoverability — banner on stderr unless --format json / --ci
  if (!wantsJsonFormat(process.argv) && process.stderr.isTTY !== false) {
    process.stderr.write(
      "This is a machine-readable manifest for coding agents driving dora. Humans: see `dora --help`.\n",
    );
  }
  const { buildCapabilities } = await import("./capabilities.js");
  process.stdout.write(JSON.stringify(buildCapabilities(), null, 2) + "\n");
  process.exit(0);
}

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

const main = defineCommand({
  meta: {
    name: "doraval",
    version: pkg.version,
    // Multi-line: citty prints this as the help banner (version appended on last line).
    description: [
      "Reads your repo and tells you what's broken in agent context.",
      "Primary: scan · review · fix · new --for <agent>.",
      "Tip: point a coding agent at this CLI, or run `dora` (scan). Docs: https://doraval.thehacksmith.dev",
    ].join("\n"),
  },
  subCommands: topLevelSubCommands,
  // Declared so citty's own parser consumes "--format json" / "--format=json"
  // correctly on the bare invocation — without these, an undeclared root flag's
  // value token gets left as a stray positional and misrouted as a subcommand.
  args: {
    format: { type: "string", description: "Output format: table | json", default: "table" },
    ci: { type: "boolean", description: "Machine mode (implies --format json)", default: false },
    cwd: { type: "string", description: "Directory to scan (CI / coding agents)" },
    yes: {
      type: "boolean",
      description: "Skip the scan proceed/stop prompt (agents / scripts)",
      default: false,
      alias: "y",
    },
    capabilities: {
      type: "boolean",
      description: "Machine JSON command manifest (for agents/CI — not a human command)",
      default: false,
    },
    completion: {
      type: "string",
      description: "Print shell completion script (bash|zsh|fish) — install plumbing, not a product command",
    },
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
