#!/usr/bin/env bun
import { defineCommand, runMain, showUsage } from "citty";
import pkg from "../../package.json";

const main = defineCommand({
  meta: {
    name: "doraval",
    version: pkg.version,
    description:
      "Validate, score, and test skills and plugins for AI coding agents",
  },
  subCommands: {
    validate: () =>
      import("./commands/validate.js").then((m) => m.default),
    score: () => import("./commands/score.js").then((m) => m.default),
  },
  run() {
    showUsage(main);
  },
});

runMain(main);
