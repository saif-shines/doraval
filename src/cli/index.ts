#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "doraval",
    version: "0.0.1",
    description:
      "Validate, score, and test skills and plugins for AI coding agents",
  },
  subCommands: {
    validate: () =>
      import("./commands/validate.js").then((m) => m.default),
    score: () => import("./commands/score.js").then((m) => m.default),
  },
});

runMain(main);
