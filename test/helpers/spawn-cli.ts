import { spawnSync } from "bun";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const cliEntry = join(repoRoot, "src", "cli", "index.ts");

export interface DoravalRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function runDoraval(args: string[]): DoravalRunResult {
  const result = spawnSync(["bun", "run", cliEntry, "--", ...args], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NO_COLOR: "1" },
  });

  return {
    exitCode: result.exitCode ?? 1,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

export function fixturePath(name: string): string {
  return join(repoRoot, "test", "fixtures", "skills", name);
}

export { repoRoot, cliEntry };
