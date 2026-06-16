import { spawnSync } from "bun";
import pc from "picocolors";
import { ui } from "../cli/out.js";

export interface RemoteJournalFile {
  content: string;
  sha?: string;
}

export function hasGhCli(): boolean {
  const result = spawnSync(["gh", "--version"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return result.exitCode === 0;
}

export function ensureGhCliOrExit(): void {
  if (hasGhCli()) return;

  ui.write(`  ${pc.red("✗")} ${pc.white("The GitHub CLI (")}${pc.bold("gh")}${pc.white(") is not installed.")}\n`);
  ui.info(`  doraval uses ${pc.bold("gh")} to fetch and sync journal files with GitHub.\n`);
  ui.info(`  Install it:\n`);
  ui.info(`    macOS:   ${pc.dim("brew install gh")}`);
  ui.info(`    Linux:   ${pc.dim("https://github.com/cli/cli/blob/trunk/docs/install_linux.md")}`);
  ui.info(`    Windows: ${pc.dim("winget install --id GitHub.cli")}\n`);
  ui.info(`  Then authenticate: ${pc.dim("gh auth login")}\n`);
  process.exit(1);
}

export function fetchRemoteJournalFile(repo: string, path: string): RemoteJournalFile | null {
  const result = spawnSync(
    ["gh", "api", `repos/${repo}/contents/${path}`, "--jq", "{sha, content, encoding}"],
    { stdout: "pipe", stderr: "pipe" }
  );

  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString();
    if (stderr.includes("404") || stderr.includes("Not Found")) {
      return null;
    }
    ui.fail(`Failed to fetch ${path} from ${repo}:`);
    ui.info(stderr);
    process.exit(1);
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
      content: decoded,
      sha: parsed.sha,
    };
  } catch {
    ui.fail(`Unexpected response when fetching ${path} from ${repo}`);
    process.exit(1);
  }
}

export async function refreshLocalJournalFile(
  repo: string,
  remotePath: string,
  localPath: string
): Promise<boolean> {
  const remote = fetchRemoteJournalFile(repo, remotePath);
  if (!remote) {
    return false;
  }
  await Bun.write(localPath, remote.content);
  return true;
}

export function getRemoteJournalFileMeta(
  repo: string,
  path: string
): { sha?: string; content: string; encoding?: string } | null {
  const result = spawnSync(
    ["gh", "api", `repos/${repo}/contents/${path}`, "--jq", "{sha, content, encoding}"],
    { stdout: "pipe", stderr: "pipe" }
  );

  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString();
    if (stderr.includes("404") || stderr.includes("Not Found")) {
      return null;
    }
    ui.fail(`Failed to fetch ${path} from ${repo}:`);
    ui.info(stderr);
    process.exit(1);
  }

  try {
    return JSON.parse(result.stdout.toString());
  } catch {
    ui.fail(`Unexpected response when fetching ${path} from ${repo}`);
    process.exit(1);
  }
}

export function getGitRemoteOwner(): string | null {
  const result = spawnSync(["git", "config", "--get", "remote.origin.url"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) return null;

  const url = result.stdout.toString().trim();
  if (!url) return null;

  const match = url.match(/[:/]([^/]+)\/([^/.]+)(\.git)?$/);
  return match ? match[1]! : null;
}

export function ghUser(): string | null {
  const result = spawnSync(["gh", "api", "user", "--jq", ".login"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) return null;
  return result.stdout.toString().trim() || null;
}

export function repoExists(repo: string): boolean {
  const result = spawnSync(
    ["gh", "api", `repos/${repo}`, "--jq", ".full_name"],
    { stdout: "pipe", stderr: "pipe" }
  );
  return result.exitCode === 0 && result.stdout.toString().trim().length > 0;
}
