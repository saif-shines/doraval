#!/usr/bin/env bun
import { defineCommand, runMain, showUsage } from "citty";
import pkg from "../../package.json" with { type: "json" };
import pc from "picocolors";
import { ui as uiHelper } from "./out.js";

const skill = defineCommand({
  meta: {
    name: "skill",
    description: "Validate, measure drift, run sessions with prompts, and judge AI agent skills",
  },
  subCommands: {
    validate: () =>
      import("./commands/validate.js").then((m) => m.default),
    drift: () => import("./commands/drift.js").then((m) => m.default),
    judge: () => import("./commands/judge.js").then((m) => m.default),

  },
  run() {
    const cliArgs = process.argv.slice(2);
    if (cliArgs[0] === "skill" && cliArgs.length > 1) return;
    showUsage(skill);
  },
});

const journal = defineCommand({
  meta: {
    name: "journal",
    description: "Decision & note memory (with optional pushback/tags) — record, view, and sync project principles and useful notes",
  },
  subCommands: {
    init: () =>
      import("./commands/journal/init.js").then((m) => m.default),
    list: () =>
      import("./commands/journal/list.js").then((m) => m.default),
    context: () =>
      import("./commands/journal/context.js").then((m) => m.default),
    hook: () =>
      import("./commands/journal/hook.js").then((m) => m.default),
    update: () =>
      import("./commands/journal/update.js").then((m) => m.default),
    add: () =>
      import("./commands/journal/add.js").then((m) => m.default),
    sync: () =>
      import("./commands/journal/sync.js").then((m) => m.default),
  },
  run() {
    const cliArgs = process.argv.slice(2);
    if (cliArgs[0] === "journal" && cliArgs.length > 1) return;
    showUsage(journal);
  },
});



const evals = defineCommand({
  meta: {
    name: "evals",
    description: "Manage eval configuration (LLM vendor, model, judge settings)",
  },
  subCommands: {
    setup: () => import("./commands/evals/setup.js").then((m) => m.default),
  },
  run() {
    const cliArgs = process.argv.slice(2);
    if (cliArgs[0] === "evals" && cliArgs.length > 1) return;
    showUsage(evals);
  },
});

// config command module already defines its own subCommands (set/get)
const config = () => import("./commands/config.js").then((m) => m.default);

const claude = defineCommand({
  meta: {
    name: "claude",
    description: "Claude Code-specific commands (packaging, scaffolding, distribution)",
  },
  subCommands: {
    new: () => import("./commands/claude/new.js").then((m) => m.default),
    bump: () => import("./commands/bump.js").then((m) => m.default),
  },
  run() {
    const cliArgs = process.argv.slice(2);
    if (cliArgs[0] === "claude" && cliArgs.length > 1) return;
    showUsage(claude);
  },
});

const codex = defineCommand({
  meta: {
    name: "codex",
    description: "Codex (OpenAI)-specific commands (packaging, scaffolding, distribution)",
  },
  subCommands: {
    new: () => import("./commands/codex/new.js").then((m) => m.default),
    bump: () => import("./commands/bump.js").then((m) => m.default),
  },
  run() {
    const cliArgs = process.argv.slice(2);
    if (cliArgs[0] === "codex" && cliArgs.length > 1) return;
    showUsage(codex);
  },
});

const cursor = defineCommand({
  meta: {
    name: "cursor",
    description: "Cursor-specific commands (packaging, scaffolding, distribution)",
  },
  subCommands: {
    new: () => import("./commands/cursor/new.js").then((m) => m.default),
    bump: () => import("./commands/bump.js").then((m) => m.default),
  },
  run() {
    const cliArgs = process.argv.slice(2);
    if (cliArgs[0] === "cursor" && cliArgs.length > 1) return;
    showUsage(cursor);
  },
});

const copilot = defineCommand({
  meta: {
    name: "copilot",
    description: "Copilot CLI-specific commands (packaging, scaffolding, distribution)",
  },
  subCommands: {
    new: () => import("./commands/copilot/new.js").then((m) => m.default),
    bump: () => import("./commands/bump.js").then((m) => m.default),
  },
  run() {
    const cliArgs = process.argv.slice(2);
    if (cliArgs[0] === "copilot" && cliArgs.length > 1) return;
    showUsage(copilot);
  },
});

const ui = defineCommand({
  meta: {
    name: "ui",
    description: "Launch the local doraval web dashboard (no more typing commands for common tasks)",
  },
  args: {
    port: {
      type: "string",
      description: "Port to run the local UI server on (default 3737)",
      default: "3737",
    },
    open: {
      type: "boolean",
      description: "Automatically open the dashboard in your browser",
      default: true,
    },
    host: {
      type: "string",
      description: "Host to bind (default 127.0.0.1 for local only)",
      default: "127.0.0.1",
    },
    status: {
      type: "boolean",
      description: "Check if a dashboard is running and print its URL (no start)",
      default: false,
    },
    force: {
      type: "boolean",
      description: "Force start/restart even if one is already running",
      default: false,
    },
  },
  async run({ args }) {
    // Always delegate for `dora ui` (with or without flags). The old guard pattern was only for groups that show usage.
    await import("./commands/ui.js").then((m) => m.default.run({ args }));
  },
});

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
  subCommands: {
    validate: () =>
      import("./commands/validate-top.js").then((m) => m.default),
    init: () => import("./commands/init.js").then((m) => m.default),
    bump: () => import("./commands/bump.js").then((m) => m.default),
    update: () => import("./commands/update.js").then((m) => m.default),
    providers: () => import("./commands/providers.js").then((m) => m.default),
    completion: () => import("./commands/completion.js").then((m) => m.default),
    skill: () => Promise.resolve(skill),
    journal: () => Promise.resolve(journal),
    eval: () => import("./commands/eval.js").then((m) => m.default),
    evals: () => Promise.resolve(evals),
    config: config,
    claude: () => Promise.resolve(claude),
    codex: () => Promise.resolve(codex),
    cursor: () => Promise.resolve(cursor),
    copilot: () => Promise.resolve(copilot),
    ui: () => Promise.resolve(ui),
  },
  run() {
    const cliArgs = process.argv.slice(2);
    if (cliArgs.length > 0) return; // subcommand provided — do not leak banner/usage to stdout

    // Show Doraemon banner before the normal usage instructions (to stderr so it doesn't pollute data output or hooks)
    if (process.stdout.isTTY) {
      uiHelper.write("\n" + pc.blue(doraemonArt) + "\n");
    }

    showUsage(main);
  },
});

runMain(main);
