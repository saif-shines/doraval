#!/usr/bin/env bun
import { defineCommand, runMain, showUsage } from "citty";
import pkg from "../../package.json" with { type: "json" };

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
  },
  run() {
    showUsage(journal);
  },
});

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
    showUsage(main);
  },
});

runMain(main);
