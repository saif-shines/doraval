#!/usr/bin/env bun

/**
 * Bump, commit, tag, and push in one command.
 *   bun run release patch
 *   bun run release minor
 *   bun run release major
 *   bun run release 1.2.3
 */

import { spawnSync } from "node:child_process";

const type = process.argv[2];
if (!type) {
  console.error("Usage: bun run release <patch|minor|major|x.y.z>");
  process.exit(1);
}

function run(cmd: string, args: string[]) {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Bump versions and capture the new version
const bump = spawnSync("bun", ["run", "scripts/bump.ts", type], { encoding: "utf8" });
if (bump.status !== 0) {
  process.stderr.write(bump.stderr);
  process.exit(bump.status ?? 1);
}
process.stdout.write(bump.stdout);

const match = bump.stdout.match(/→ (\d+\.\d+\.\d+)/);
if (!match) {
  console.error("Could not parse new version from bump output");
  process.exit(1);
}
const version = match[1];
const tag = `v${version}`;

run("git", ["add", "package.json", "jsr.json", "apps/website/package.json"]);
run("git", ["commit", "-m", `chore: bump version to ${version}`]);
run("git", ["tag", tag]);
run("git", ["push"]);
run("git", ["push", "--tags"]);

console.log(`\nReleased ${tag} — CI pipeline triggered.`);
