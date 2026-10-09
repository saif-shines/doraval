#!/usr/bin/env node
"use strict";

/**
 * Entire agent program for Hermes pocket agents.
 * Entire discovers this name on PATH. It does not install hooks by itself.
 * Next: entire agent add hermes
 */

const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { homedir } = require("node:os");

function hermesHome() {
  const env = process.env.HERMES_HOME;
  if (env && env.trim()) return env.trim();
  return join(homedir(), ".hermes");
}

function out(value) {
  process.stdout.write(JSON.stringify(value) + "\n");
}

function flag(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

const command = process.argv[2];

if (command === "info") {
  out({
    protocol_version: 1,
    name: "hermes",
    type: "Hermes",
    description: "Pocket agent sessions Dora runs through Hermes",
    protected_dirs: [".hermes"],
    hook_names: ["session-start", "session-end", "stop"],
    capabilities: {
      hooks: false,
      transcript_analyzer: false,
      transcript_preparer: false,
      token_calculator: false,
      text_generator: false,
      hook_response_writer: false,
      subagent_aware_extractor: false,
    },
  });
  process.exit(0);
}

if (command === "detect") {
  out({ present: existsSync(hermesHome()) });
  process.exit(0);
}

if (command === "get-session-dir") {
  out({ path: hermesHome() });
  process.exit(0);
}

if (command === "read-transcript") {
  const ref = flag("--session-ref");
  if (!ref || !existsSync(ref)) {
    process.stderr.write("session ref not found\n");
    process.exit(1);
  }
  process.stdout.write(readFileSync(ref));
  process.exit(0);
}

process.stderr.write("unknown entire-agent-hermes command\n");
process.exit(1);
