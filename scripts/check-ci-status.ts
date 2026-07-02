#!/usr/bin/env bun

/**
 * Warn about recent GitHub Actions failures for the current branch.
 * Best-effort: skips silently if `gh` is missing/unauthenticated, or if
 * already running inside CI (avoids checking CI from within CI).
 */

if (process.env.CI) process.exit(0);

const branchProc = Bun.spawnSync(["git", "rev-parse", "--abbrev-ref", "HEAD"], { stdout: "pipe", stderr: "pipe" });
if (branchProc.exitCode !== 0) process.exit(0);
const branch = branchProc.stdout.toString().trim();
if (!branch || branch === "HEAD") process.exit(0); // detached HEAD — nothing to look up

const proc = Bun.spawnSync(
  ["gh", "run", "list", "--branch", branch, "--limit", "10", "--json", "status,conclusion,workflowName,url,headSha"],
  { stdout: "pipe", stderr: "pipe" }
);

if (proc.exitCode !== 0) process.exit(0); // gh missing / not authed / not a gh repo — stay silent

let runs: Array<{ status: string; conclusion: string | null; workflowName: string; url: string; headSha: string }>;
try {
  runs = JSON.parse(proc.stdout.toString());
} catch {
  process.exit(0);
}

const failed = runs.filter((r) => r.status === "completed" && r.conclusion === "failure");
if (failed.length === 0) process.exit(0);

console.warn(`\n⚠ ${failed.length} recent GitHub Actions failure(s) on this branch:`);
for (const r of failed) {
  console.warn(`  - ${r.workflowName} (${r.headSha.slice(0, 7)}): ${r.url}`);
}
console.warn("");
