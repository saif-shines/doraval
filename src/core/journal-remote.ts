import { spawnSync } from "bun";
import pc from "picocolors";

export interface RemoteJournalFile {
  content: string; // decoded UTF-8
  sha?: string;
}

/**
 * Check whether the GitHub CLI (`gh`) is available on PATH.
 */
export function hasGhCli(): boolean {
  const result = spawnSync(["gh", "--version"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return result.exitCode === 0;
}

/**
 * Exit the process with a helpful message if `gh` is not installed.
 */
export function ensureGhCliOrExit(): void {
  if (hasGhCli()) return;

  console.error(`  ${pc.red("✗")} The GitHub CLI (${pc.bold("gh")}) is not installed.\n`);
  console.error(`  doraval uses ${pc.bold("gh")} to fetch and sync journal files with GitHub.\n`);
  console.error(`  Install it:\n`);
  console.error(`    macOS:   ${pc.dim("brew install gh")}`);
  console.error(`    Linux:   ${pc.dim("https://github.com/cli/cli/blob/trunk/docs/install_linux.md")}`);
  console.error(`    Windows: ${pc.dim("winget install --id GitHub.cli")}\n`);
  console.error(`  Then authenticate: ${pc.dim("gh auth login")}\n`);
  process.exit(1);
}

/**
 * Fetch a file's metadata + decoded content from a GitHub repo using `gh api`.
 * Returns null if the file does not exist (404).
 * For other errors (auth, network, etc.) it prints and exits (consistent with existing behavior).
 */
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
    console.error(`Failed to fetch ${path} from ${repo}:`);
    console.error(stderr);
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
    console.error(`Unexpected response when fetching ${path} from ${repo}`);
    process.exit(1);
  }
}

/**
 * Fetch + write a remote journal file to the given local path.
 * Returns true if the file existed on remote and was written.
 * Returns false (and does not write) if it was not found (404).
 */
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

/**
 * Get the raw GitHub file response (with base64 content + sha) for use
 * in conditional writes (e.g. sync's merge + push).
 */
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
    console.error(`Failed to fetch ${path} from ${repo}:`);
    console.error(stderr);
    process.exit(1);
  }

  try {
    return JSON.parse(result.stdout.toString());
  } catch {
    console.error(`Unexpected response when fetching ${path} from ${repo}`);
    process.exit(1);
  }
}
