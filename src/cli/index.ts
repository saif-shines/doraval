#!/usr/bin/env bun
import { defineCommand, runMain, showUsage } from "citty";
import pkg from "../../package.json" with { type: "json" };
import pc from "picocolors";
import { ui as uiHelper } from "./out.js";
import { registerLifecycleHandlers } from "./render/exit.js";
import { resolveRenderMode } from "./render/mode.js";
import { topLevelSubCommands } from "./command-tree.js";

// Register terminal-restore handlers before any command runs.
// Ensures the terminal is always restored even on direct process.exit() calls
// or uncaught errors, once a TUI backend is active.
registerLifecycleHandlers();

// Doraemon banner - shown when user just runs "doraval" with no subcommand
const doraemonArt = `
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣠⣤⣴⣶⣶⣶⣶⣶⠶⣶⣤⣤⣀⠀⠀⠀⠀⠀⠀ 
⠀⠀⠀⠀⠀⠀⠀⢀⣤⣾⣿⣿⣿⠁⠀⢀⠈⢿⢀⣀⠀⠹⣿⣿⣿⣦⣄⠀⠀⠀ 
⠀⠀⠀⠀⠀⠀⣴⣿⣿⣿⣿⣿⠿⠀⠀⣟⡇⢘⣾⣽⠀⠀⡏⠉⠙⢛⣿⣷⡖⠀ 
⠀⠀⠀⠀⠀⣾⣿⣿⡿⠿⠷⠶⠤⠙⠒⠀⠒⢻⣿⣿⡷⠋⠀⠴⠞⠋⠁⢙⣿⣄ 
⠀⠀⠀⠀⢸⣿⣿⣯⣤⣤⣤⣤⣤⡄⠀⠀⠀⠀⠉⢹⡄⠀⠀⠀⠛⠛⠋⠉⠹⡇ 
⠀⠀⠀⠀⢸⣿⣿⠀⠀⠀⣀⣠⣤⣤⣤⣤⣤⣤⣤⣼⣇⣀⣀⣀⣛⣛⣒⣲⢾⡷ 
⢀⠤⠒⠒⢼⣿⣿⠶⠞⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠁⠀⣼⠃ 
⢮⠀⠀⠀⠀⣿⣿⣆⠀⠀⠻⣿⡿⠛⠉⠉⠁⠀⠉⠉⠛⠿⣿⣿⠟⠁⠀⣼⠃⠀ 
⠈⠓⠶⣶⣾⣿⣿⣿⣧⡀⠀⠈⠒⢤⣀⣀⡀⠀⠀⣀⣀⡠⠚⠁⠀⢀⡼⠃⠀⠀ 
⠀⠀⠀⠈⢿⣿⣿⣿⣿⣿⣷⣤⣤⣤⣤⣭⣭⣭⣭⣭⣥⣤⣤⣤⣴⣟⠁
`.trim();

const main = defineCommand({
  meta: {
    name: "doraval",
    version: pkg.version,
    description:
      "Scale your AI context for coding agents. Make your next context work (skills, plugins & more) for your team, community, or self. Context engineering toolkit for AI coding agents.",
  },
  subCommands: topLevelSubCommands,
  async run() {
    const cliArgs = process.argv.slice(2);
    if (cliArgs.length > 0) return; // subcommand provided

    // Bare `dora` on a real TTY → full-screen hub
    if (resolveRenderMode() === "tui") {
      try {
        const { launchApp } = await import("./tui/app.js");
        await launchApp();
        return;
      } catch {
        // FFI unavailable or init error — fall through to banner
      }
    }

    if (process.stdout.isTTY) {
      uiHelper.write("\n" + pc.blue(doraemonArt) + "\n");
    }
    showUsage(main);
  },
});

runMain(main);
