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
    description: "Decision memory with pushback — record, check, and sync project principles",
  },
  subCommands: {
    init: () =>
      import("./commands/journal/init.js").then((m) => m.default),
    list: () =>
      import("./commands/journal/list.js").then((m) => m.default),
    add: () =>
      import("./commands/journal/add.js").then((m) => m.default),
    sync: () =>
      import("./commands/journal/sync.js").then((m) => m.default),
  },
  run() {
    showUsage(journal);
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
      "Validate, score, and test skills and plugins for AI coding agents",
  },
  subCommands: {
    skill: () => Promise.resolve(skill),
    journal: () => Promise.resolve(journal),
  },
  run() {
    // Show Doraemon banner before the normal usage instructions
    console.log("\n" + pc.blue(doraemonArt) + "\n");

    showUsage(main);
  },
});

runMain(main);
