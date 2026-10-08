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

export interface RunOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
}

function childEnv(extraIn: Record<string, string | undefined>): Record<string, string | undefined> {
  const extra = { ...extraIn };
  // Windows os.homedir() reads USERPROFILE, not HOME.
  if (process.platform === "win32" && extra.HOME && extra.USERPROFILE === undefined) {
    extra.USERPROFILE = extra.HOME;
  }
  const env: Record<string, string | undefined> = { ...process.env, NO_COLOR: "1" };
  const pathOverride = extra.PATH ?? extra.Path;
  if (process.platform === "win32" && pathOverride !== undefined) {
    // Windows keeps one path value. A second Path key hides the test shim.
    for (const key of Object.keys(env)) {
      if (key.toLowerCase() === "path") delete env[key];
    }
    delete extra.PATH;
    delete extra.Path;
    env.Path = pathOverride;
    env.PATH = pathOverride;
  }
  return { ...env, ...extra };
}

export function runDoraval(args: string[], options: RunOptions = {}): DoravalRunResult {
  const result = spawnSync(["bun", "run", cliEntry, "--", ...args], {
    cwd: options.cwd ?? repoRoot,
    stdout: "pipe",
    stderr: "pipe",
    env: childEnv(options.env || {}),
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
