import { spawnSync } from "child_process";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export interface ParsedRemote {
  /** Original input for display */
  original: string;
  /** Owner/repo for gh CLI (GitHub only) */
  ghRepo?: string;
  /** Full git-cloneable URL */
  gitUrl: string;
  /** Branch or tag */
  ref?: string;
  /** Subdirectory within the repo */
  subpath?: string;
}

// Matches: https://github.com/owner/repo[/tree|blob/ref[/subpath]]
// Also:    github.com/owner/repo (no scheme)
const GITHUB_RE =
  /^(?:https?:\/\/)?github\.com\/([^/]+\/[^/]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^/]+)(?:\/(.+))?)?$/;

// Matches: https://host.com/owner/repo[.git]
const GENERIC_GIT_RE =
  /^https?:\/\/[^/]+\/[^/]+\/[^/]+/;

/**
 * Returns null if input is a local path, ParsedRemote if it looks like a URL.
 */
export function parseRemoteUrl(input: string): ParsedRemote | null {
  // Local paths: starts with . / ~ or is a bare name without dots that looks like a dir
  if (
    input.startsWith(".") ||
    input.startsWith("/") ||
    input.startsWith("~")
  ) {
    return null;
  }

  // Try GitHub-specific pattern first
  const ghMatch = input.match(GITHUB_RE);
  if (ghMatch) {
    const [, ownerRepo, ref, subpath] = ghMatch;
    return {
      original: input,
      ghRepo: ownerRepo,
      gitUrl: `https://github.com/${ownerRepo}.git`,
      ref,
      subpath,
    };
  }

  // Generic git URL (https://gitlab.com/user/repo, etc.)
  if (GENERIC_GIT_RE.test(input)) {
    const gitUrl = input.endsWith(".git") ? input : `${input}.git`;
    return {
      original: input,
      gitUrl,
    };
  }

  return null;
}

let ghAvailable: boolean | null = null;

function isGhAvailable(): boolean {
  if (ghAvailable !== null) return ghAvailable;
  try {
    const result = spawnSync("gh", ["auth", "status"], {
      stdio: "pipe",
      timeout: 5000,
    });
    if (result.error) {
      ghAvailable = false;
      return false;
    }
    ghAvailable = result.status === 0;
    return ghAvailable;
  } catch {
    ghAvailable = false;
    return false;
  }
}

let gitAvailable: boolean | null = null;

export function hasGitCli(): boolean {
  if (gitAvailable !== null) return gitAvailable;
  try {
    const result = spawnSync("git", ["--version"], {
      stdio: "pipe",
      timeout: 5000,
    });
    if (result.error) {
      gitAvailable = false;
      return false;
    }
    gitAvailable = result.status === 0;
    return gitAvailable;
  } catch {
    gitAvailable = false;
    return false;
  }
}

/**
 * Clone a remote repo to a temp directory.
 * For GitHub repos: tries `gh repo clone` first, falls back to `git clone`.
 * For other hosts: uses `git clone` directly.
 */
export async function cloneToTemp(
  parsed: ParsedRemote
): Promise<{ dir: string; cleanup: () => void }> {
  const tmpDir = mkdtempSync(join(tmpdir(), "dora-"));
  const cleanup = () => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  };

  // Register safety-net cleanup for process.exit() calls
  const exitHandler = () => cleanup();
  process.on("exit", exitHandler);

  const removeExitHandler = () => {
    process.removeListener("exit", exitHandler);
  };

  const wrappedCleanup = () => {
    removeExitHandler();
    cleanup();
  };

  // Try gh first for GitHub repos
  if (parsed.ghRepo && isGhAvailable()) {
    const ghArgs = ["repo", "clone", parsed.ghRepo, tmpDir, "--"];
    ghArgs.push("--depth", "1");
    if (parsed.ref) ghArgs.push("--branch", parsed.ref);

    const gh = spawnSync("gh", ghArgs, { stdio: "pipe", timeout: 60000 });
    if (gh.status === 0) {
      return { dir: tmpDir, cleanup: wrappedCleanup };
    }
    // gh failed — fall through to git clone silently
  }

  // git clone fallback
  if (!hasGitCli()) {
    wrappedCleanup();
    throw new Error("git is not installed. Install git to clone remote repositories for validation.");
  }

  const gitArgs = ["clone", "--depth", "1"];
  if (parsed.ref) gitArgs.push("--branch", parsed.ref);
  gitArgs.push(parsed.gitUrl, tmpDir);

  const git = spawnSync("git", gitArgs, { stdio: "pipe", timeout: 60000 });
  if (git.status !== 0 || git.error) {
    wrappedCleanup();
    if (git.error && /ENOENT|not found/i.test(String(git.error))) {
      throw new Error("git is not installed. Install git to clone remote repositories for validation.");
    }
    const stderr = git.stderr?.toString().trim() || git.error?.message || "unknown error";
    throw new Error(`Failed to clone ${parsed.original}: ${stderr}`);
  }

  return { dir: tmpDir, cleanup: wrappedCleanup };
}