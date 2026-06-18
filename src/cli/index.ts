#!/usr/bin/env bun
import { defineCommand, runMain, showUsage } from "citty";
import pkg from "../../package.json" with { type: "json" };
import pc from "picocolors";

const skill = defineCommand({
  meta: {
    name: "skill",
    description: "Validate, measure drift, and judge AI agent skills",
  },
  subCommands: {
    validate: () =>
      import("./commands/validate.js").then((m) => m.default),
    drift: () => import("./commands/drift.js").then((m) => m.default),
    judge: () => import("./commands/judge.js").then((m) => m.default),
  },
  run() {
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
    update: () =>
      import("./commands/journal/update.js").then((m) => m.default),
    add: () =>
      import("./commands/journal/add.js").then((m) => m.default),
    sync: () =>
      import("./commands/journal/sync.js").then((m) => m.default),
  },
  run() {
    showUsage(journal);
  },
});

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
    showUsage(copilot);
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
      "The context engineering toolkit for coding agents",
  },
  subCommands: {
    validate: () =>
      import("./commands/validate-top.js").then((m) => m.default),
    init: () => import("./commands/init.js").then((m) => m.default),
    bump: () => import("./commands/bump.js").then((m) => m.default),
    update: () => import("./commands/update.js").then((m) => m.default),
    providers: () => import("./commands/providers.js").then((m) => m.default),
    skill: () => Promise.resolve(skill),
    journal: () => Promise.resolve(journal),
    claude: () => Promise.resolve(claude),
    codex: () => Promise.resolve(codex),
    cursor: () => Promise.resolve(cursor),
    copilot: () => Promise.resolve(copilot),
  },
  run() {
    // Show Doraemon banner before the normal usage instructions
    console.log("\n" + pc.blue(doraemonArt) + "\n");

    showUsage(main);
  },
});

runMain(main);
