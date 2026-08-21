/**
 * Idempotent platform + main npm publish for CI.
 * A first publish can succeed while `npm view` still lags. Retry must not
 * re-PUT that version (E409 "previously staged"). Skip if the version is
 * already on the registry; treat 409-as-already-published; then wait.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export interface NpmResult {
  status: number;
  stdout: string;
  stderr: string;
}

export type NpmFn = (args: string[], cwd?: string) => NpmResult;

export function publishAccepted(result: NpmResult): boolean {
  if (result.status === 0) return true;
  const text = `${result.stderr}\n${result.stdout}`;
  return /npm error code E409|previously staged version|cannot publish over the previously published/i.test(text);
}

export function versionVisible(npm: NpmFn, name: string, version: string): boolean {
  const r = npm(["view", `${name}@${version}`, "version"]);
  const last = r.stdout.trim().split("\n").filter(Boolean).at(-1) ?? "";
  return r.status === 0 && last === version;
}

export function ensurePublished(opts: {
  name: string;
  version: string;
  dir: string;
  npm: NpmFn;
  viewAttempts?: number;
  sleepMs?: number;
  sleep?: (ms: number) => void;
}): "skipped" | "published" {
  const {
    name,
    version,
    dir,
    npm,
    viewAttempts = 18,
    sleepMs = 10_000,
    sleep = (ms) => Bun.sleepSync(ms),
  } = opts;

  const already = versionVisible(npm, name, version);
  if (!already) {
    const pub = npm(["publish", "--access", "public"], dir);
    if (!publishAccepted(pub)) {
      throw new Error(`publish ${name}@${version} failed:\n${pub.stderr || pub.stdout}`);
    }
  }

  for (let i = 1; i <= viewAttempts; i++) {
    if (versionVisible(npm, name, version)) return already ? "skipped" : "published";
    if (i === viewAttempts) {
      throw new Error(`${name}@${version} not visible on registry after publish`);
    }
    sleep(sleepMs);
  }
  return already ? "skipped" : "published";
}

function realNpm(args: string[], cwd?: string): NpmResult {
  const r = spawnSync("npm", args, { encoding: "utf8", cwd });
  return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

if (import.meta.main) {
  try {
    const version = (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;
    const root = "platform-packages";
    for (const ent of readdirSync(root, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const dir = join(root, ent.name);
      const name = (JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name: string }).name;
      console.log(`Publishing ${name}@${version} from ${dir}/`);
      const result = ensurePublished({ name, version, dir, npm: realNpm });
      console.log(result === "skipped" ? `OK ${name}@${version} already on registry` : `OK ${name}@${version} on registry`);
    }

    const prep = spawnSync("bun", ["run", "scripts/prepare-npm-publish.ts"], { encoding: "utf8", stdio: "inherit" });
    if ((prep.status ?? 1) !== 0) process.exit(prep.status ?? 1);

    const mainName = (JSON.parse(readFileSync("package.json", "utf8")) as { name: string }).name;
    console.log(`Publishing ${mainName}@${version}`);
    const result = ensurePublished({ name: mainName, version, dir: ".", npm: realNpm });
    console.log(result === "skipped" ? `OK ${mainName}@${version} already on registry` : `OK ${mainName}@${version} on registry`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
