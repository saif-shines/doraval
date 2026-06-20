import { spawnSync } from "bun";

export interface RemoteJournalFile {
  content: string;
  sha?: string;
}

export type RemoteResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; isNotFound?: boolean };

function tryGh(args: string[]) {
  try {
    const result = spawnSync(["gh", ...args], { stdout: "pipe", stderr: "pipe" });
    return { ok: true as const, result };
  } catch {
    return { ok: false as const };
  }
}

function tryGit(args: string[]) {
  try {
    const result = spawnSync(["git", ...args], { stdout: "pipe", stderr: "pipe" });
    return { ok: true as const, result };
  } catch {
    return { ok: false as const };
  }
}

export function hasGhCli(): boolean {
  const r = tryGh(["--version"]);
  return r.ok && r.result.exitCode === 0;
}

export function hasGitCli(): boolean {
  const r = tryGit(["--version"]);
  return r.ok && r.result.exitCode === 0;
}

export function ensureGhCli(): RemoteResult<true> {
  if (hasGhCli()) return { ok: true, value: true };

  return { ok: false, error: "GH_CLI_MISSING" };
}

export function fetchRemoteJournalFile(repo: string, path: string): RemoteResult<RemoteJournalFile> {
  const r = tryGh(["api", `repos/${repo}/contents/${path}`, "--jq", "{sha, content, encoding}"]);
  if (!r.ok) {
    return { ok: false, error: "The GitHub CLI (gh) is not installed. Run `gh --version` to verify." };
  }
  const result = r.result;
  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString();
    if (stderr.includes("404") || stderr.includes("Not Found")) {
      return { ok: false, error: "not found", isNotFound: true };
    }
    return { ok: false, error: stderr };
  }

  try {
    const parsed = JSON.parse(result.stdout.toString()) as {
      sha?: string;
      content: string;
      encoding?: string;
    };

    let decoded: string;
    if (!parsed.encoding || parsed.encoding === "base64") {
      decoded = Buffer.from(parsed.content, "base64").toString("utf-8");
    } else {
      decoded = parsed.content;
    }

    return {
      ok: true,
      value: {
        content: decoded,
        sha: parsed.sha,
      },
    };
  } catch {
    return { ok: false, error: `Unexpected response when fetching ${path} from ${repo}` };
  }
}

export async function refreshLocalJournalFile(
  repo: string,
  remotePath: string,
  localPath: string
): Promise<RemoteResult<boolean>> {
  const res = fetchRemoteJournalFile(repo, remotePath);
  if (!res.ok) {
    if (res.isNotFound) {
      return { ok: true, value: false };
    }
    return { ok: false, error: res.error };
  }
  const remote = res.value;
  await Bun.write(localPath, remote.content);
  return { ok: true, value: true };
}

export function getRemoteJournalFileMeta(
  repo: string,
  path: string
): RemoteResult<{ sha?: string; content: string; encoding?: string }> {
  const r = tryGh(["api", `repos/${repo}/contents/${path}`, "--jq", "{sha, content, encoding}"]);
  if (!r.ok) {
    return { ok: false, error: "The GitHub CLI (gh) is not installed. Run `gh --version` to verify." };
  }
  const result = r.result;

  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString();
    if (stderr.includes("404") || stderr.includes("Not Found")) {
      return { ok: false, error: "not found", isNotFound: true };
    }
    return { ok: false, error: stderr };
  }

  try {
    const parsed = JSON.parse(result.stdout.toString()) as { sha?: string; content: string; encoding?: string };
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, error: `Unexpected response when fetching ${path} from ${repo}` };
  }
}

export function getGitRemoteOwner(): string | null {
  const r = tryGit(["config", "--get", "remote.origin.url"]);
  if (!r.ok) return null;
  const result = r.result;
  if (result.exitCode !== 0) return null;

  const url = result.stdout.toString().trim();
  if (!url) return null;

  const match = url.match(/[:/]([^/]+)\/([^/.]+)(\.git)?$/);
  return match ? match[1]! : null;
}

export function ghUser(): string | null {
  const r = tryGh(["api", "user", "--jq", ".login"]);
  if (!r.ok) return null;
  const result = r.result;
  if (result.exitCode !== 0) return null;
  return result.stdout.toString().trim() || null;
}

export function repoExists(repo: string): boolean {
  const r = tryGh(["api", `repos/${repo}`, "--jq", ".full_name"]);
  if (!r.ok) return false;
  const result = r.result;
  return result.exitCode === 0 && result.stdout.toString().trim().length > 0;
}
