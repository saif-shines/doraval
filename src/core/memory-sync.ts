import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  rmSync,
  cpSync,
  readdirSync,
} from "fs";
import { join } from "path";
import { spawnSync } from "bun";
import { YAML } from "bun";
import {
  getMemoryDir,
  getMemoryRepoDir,
  getMemoryRemoteConfigPath,
  ensureMemoryDirs,
} from "./memory-config.js";

// ── Types ──────────────────────────────────────────────────────────

export type RunResult = { exitCode: number; stdout: string; stderr: string };

export interface SyncDeps {
  runGit: (args: string[], opts?: { cwd?: string }) => RunResult;
  runGh: (args: string[]) => RunResult;
}

export type SyncResult =
  | {
      ok: true;
      repo: string;
      gitUrl: string;
      committed: boolean;
      pulled: boolean;
      pushed: boolean;
      bootstrapped: boolean;
      message: string;
    }
  | { ok: false; error: string; code: string };

export interface SyncOptions {
  /** owner/name or any git-cloneable URL. Resolved from config / gh user if omitted. */
  repo?: string;
  /** Commit message when there are local changes. */
  message?: string;
  deps?: SyncDeps;
}

interface MemoryRemoteConfig {
  repo: string;
}

const GITATTRIBUTES = `# Append-only principle files: concurrent syncs union-merge on rebase.
**/principles.md merge=union
`;

const DEFAULT_REPO_NAME = "dora-memory";
const DEFAULT_COMMIT = "memory: sync";

// ── Process runners ────────────────────────────────────────────────

function trySpawn(cmd: string, args: string[], opts?: { cwd?: string }): RunResult {
  try {
    const result = spawnSync([cmd, ...args], {
      cwd: opts?.cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    return {
      exitCode: result.exitCode ?? 1,
      stdout: result.stdout?.toString() ?? "",
      stderr: result.stderr?.toString() ?? "",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { exitCode: 1, stdout: "", stderr: msg };
  }
}

export function defaultSyncDeps(): SyncDeps {
  return {
    runGit: (args, opts) => trySpawn("git", args, opts),
    runGh: (args) => trySpawn("gh", args),
  };
}

// ── Remote config ──────────────────────────────────────────────────

export function loadMemoryRemoteConfig(): MemoryRemoteConfig | null {
  const path = getMemoryRemoteConfigPath();
  if (!existsSync(path)) return null;
  try {
    const parsed = YAML.parse(readFileSync(path, "utf-8")) as MemoryRemoteConfig | null;
    if (parsed && typeof parsed.repo === "string" && parsed.repo.trim()) {
      return { repo: parsed.repo.trim() };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveMemoryRemoteConfig(repo: string): void {
  ensureMemoryDirs();
  const dir = getMemoryDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(getMemoryRemoteConfigPath(), YAML.stringify({ repo }), "utf-8");
}

// ── Git / gh probes ────────────────────────────────────────────────

export function hasGitCli(deps: SyncDeps = defaultSyncDeps()): boolean {
  return deps.runGit(["--version"]).exitCode === 0;
}

export function hasGhCli(deps: SyncDeps = defaultSyncDeps()): boolean {
  return deps.runGh(["--version"]).exitCode === 0;
}

/** True only when `gh auth status` succeeds (installed alone is not enough). */
export function isGhAuthenticated(deps: SyncDeps = defaultSyncDeps()): boolean {
  return deps.runGh(["auth", "status"]).exitCode === 0;
}

export function ghLogin(deps: SyncDeps = defaultSyncDeps()): string | null {
  const r = deps.runGh(["api", "user", "--jq", ".login"]);
  if (r.exitCode !== 0) return null;
  const login = r.stdout.trim();
  return login || null;
}

export function githubRepoExists(repo: string, deps: SyncDeps = defaultSyncDeps()): boolean {
  const r = deps.runGh(["api", `repos/${repo}`, "--jq", ".full_name"]);
  return r.exitCode === 0 && r.stdout.trim().length > 0;
}

/**
 * Create a private GitHub repo if missing. No-op when it already exists.
 * `repo` must be `owner/name`.
 */
export function ensureGithubRepo(
  repo: string,
  deps: SyncDeps = defaultSyncDeps(),
): { ok: true } | { ok: false; error: string } {
  if (githubRepoExists(repo, deps)) return { ok: true };
  const r = deps.runGh([
    "repo",
    "create",
    repo,
    "--private",
    "--description",
    "doraval project memory (principles + stashed artifacts)",
  ]);
  if (r.exitCode !== 0) {
    return {
      ok: false,
      error: r.stderr.trim() || r.stdout.trim() || `Failed to create GitHub repo ${repo}`,
    };
  }
  return { ok: true };
}

// ── Path / URL helpers ─────────────────────────────────────────────

export function isGitRepository(dir: string, deps: SyncDeps = defaultSyncDeps()): boolean {
  if (!existsSync(dir)) return false;
  const r = deps.runGit(["rev-parse", "--is-inside-work-tree"], { cwd: dir });
  return r.exitCode === 0 && r.stdout.trim() === "true";
}

/**
 * Accepts `owner/name`, `https://…`, `git@…`, or a local path (incl. bare repos).
 * Returns a URL/path suitable for `git clone` / `git remote add`.
 */
export function toGitUrl(repo: string): string {
  const trimmed = repo.trim();
  if (!trimmed) return trimmed;
  // Already a URL or scp-like git@host:path
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("git@") ||
    trimmed.startsWith("ssh://") ||
    trimmed.startsWith("file://")
  ) {
    return trimmed;
  }
  // Absolute or relative local path
  if (trimmed.startsWith("/") || trimmed.startsWith(".") || trimmed.startsWith("~")) {
    return trimmed;
  }
  // owner/name → GitHub HTTPS
  if (/^[^/]+\/[^/]+$/.test(trimmed)) {
    return `https://github.com/${trimmed}.git`;
  }
  return trimmed;
}

export function isGithubOwnerName(repo: string): boolean {
  return /^[^/.\s]+\/[^/.\s]+$/.test(repo.trim()) && !repo.includes(":");
}

export function ensureUnionGitattributes(repoDir: string): boolean {
  const path = join(repoDir, ".gitattributes");
  const existing = existsSync(path) ? readFileSync(path, "utf-8") : "";
  if (existing.includes("merge=union") && existing.includes("principles.md")) {
    return false;
  }
  const next = existing.trimEnd()
    ? `${existing.trimEnd()}\n${GITATTRIBUTES}`
    : GITATTRIBUTES;
  if (!existsSync(repoDir)) mkdirSync(repoDir, { recursive: true });
  writeFileSync(path, next, "utf-8");
  return true;
}

function dirHasContent(dir: string): boolean {
  if (!existsSync(dir)) return false;
  return readdirSync(dir).filter((n) => n !== ".git").length > 0;
}

function remoteHasCommits(gitUrl: string, deps: SyncDeps): boolean {
  const r = deps.runGit(["ls-remote", "--heads", gitUrl]);
  if (r.exitCode !== 0) return false;
  return r.stdout.trim().length > 0;
}

function currentBranch(repoDir: string, deps: SyncDeps): string {
  const r = deps.runGit(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoDir });
  if (r.exitCode === 0 && r.stdout.trim() && r.stdout.trim() !== "HEAD") {
    return r.stdout.trim();
  }
  return "main";
}

function hasUncommittedChanges(repoDir: string, deps: SyncDeps): boolean {
  const r = deps.runGit(["status", "--porcelain"], { cwd: repoDir });
  return r.exitCode === 0 && r.stdout.trim().length > 0;
}

function gitOk(r: RunResult, label: string): { ok: true } | { ok: false; error: string } {
  if (r.exitCode === 0) return { ok: true };
  const detail = (r.stderr || r.stdout).trim() || `exit ${r.exitCode}`;
  return { ok: false, error: `${label}: ${detail}` };
}

// ── Bootstrap (first sync) ─────────────────────────────────────────

/**
 * Turn a plain `memory/repo` directory into a git clone of `gitUrl`,
 * adopting any pre-existing local files.
 */
export function bootstrapMemoryRepo(
  repoDir: string,
  gitUrl: string,
  deps: SyncDeps = defaultSyncDeps(),
): { ok: true } | { ok: false; error: string } {
  if (!existsSync(repoDir)) mkdirSync(repoDir, { recursive: true });

  if (isGitRepository(repoDir, deps)) {
    // Ensure origin points at the intended remote
    const remote = deps.runGit(["remote", "get-url", "origin"], { cwd: repoDir });
    if (remote.exitCode !== 0) {
      const add = deps.runGit(["remote", "add", "origin", gitUrl], { cwd: repoDir });
      const check = gitOk(add, "git remote add");
      if (!check.ok) return check;
    }
    return { ok: true };
  }

  const remoteReady = remoteHasCommits(gitUrl, deps);

  if (!remoteReady) {
    // Empty remote: init locally, commit existing content, push.
    let r = deps.runGit(["init", "-b", "main"], { cwd: repoDir });
    // Older git without -b: fall back
    if (r.exitCode !== 0) {
      r = deps.runGit(["init"], { cwd: repoDir });
      const checkInit = gitOk(r, "git init");
      if (!checkInit.ok) return checkInit;
      deps.runGit(["checkout", "-b", "main"], { cwd: repoDir });
    }
    ensureUnionGitattributes(repoDir);
    r = deps.runGit(["add", "-A"], { cwd: repoDir });
    let check = gitOk(r, "git add");
    if (!check.ok) return check;

    // Identity for the bootstrap commit (local-only config)
    deps.runGit(["config", "user.email", "doraval@local"], { cwd: repoDir });
    deps.runGit(["config", "user.name", "doraval"], { cwd: repoDir });

    r = deps.runGit(
      ["commit", "--allow-empty", "-m", "memory: initial"],
      { cwd: repoDir },
    );
    check = gitOk(r, "git commit");
    if (!check.ok) return check;

    r = deps.runGit(["remote", "add", "origin", gitUrl], { cwd: repoDir });
    check = gitOk(r, "git remote add");
    if (!check.ok) return check;

    r = deps.runGit(["push", "-u", "origin", "main"], { cwd: repoDir });
    check = gitOk(r, "git push");
    if (!check.ok) return check;
    return { ok: true };
  }

  // Remote has history: clone into a temp dir, overlay local files, swap in.
  const parent = join(repoDir, "..");
  const tmpClone = join(parent, `repo.clone-tmp-${Date.now()}`);
  const localHold = join(parent, `repo.local-hold-${Date.now()}`);

  try {
    if (dirHasContent(repoDir)) {
      renameSync(repoDir, localHold);
    } else if (existsSync(repoDir)) {
      rmSync(repoDir, { recursive: true, force: true });
    }

    let r = deps.runGit(["clone", gitUrl, tmpClone]);
    let check = gitOk(r, "git clone");
    if (!check.ok) return check;

    if (existsSync(localHold)) {
      // Overlay local files onto the clone (local content wins on conflict).
      for (const name of readdirSync(localHold)) {
        if (name === ".git") continue;
        cpSync(join(localHold, name), join(tmpClone, name), { recursive: true, force: true });
      }
      rmSync(localHold, { recursive: true, force: true });
    }

    ensureUnionGitattributes(tmpClone);
    renameSync(tmpClone, repoDir);

    deps.runGit(["config", "user.email", "doraval@local"], { cwd: repoDir });
    deps.runGit(["config", "user.name", "doraval"], { cwd: repoDir });

    if (hasUncommittedChanges(repoDir, deps)) {
      r = deps.runGit(["add", "-A"], { cwd: repoDir });
      check = gitOk(r, "git add");
      if (!check.ok) return check;
      r = deps.runGit(["commit", "-m", "memory: adopt local files"], { cwd: repoDir });
      check = gitOk(r, "git commit");
      if (!check.ok) return check;
      r = deps.runGit(["push"], { cwd: repoDir });
      check = gitOk(r, "git push");
      if (!check.ok) return check;
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `bootstrap failed: ${msg}` };
  } finally {
    if (existsSync(tmpClone)) rmSync(tmpClone, { recursive: true, force: true });
    // If we failed mid-flight and localHold still exists but repoDir doesn't, restore it.
    if (existsSync(localHold) && !existsSync(repoDir)) {
      try {
        renameSync(localHold, repoDir);
      } catch {
        /* best effort */
      }
    } else if (existsSync(localHold)) {
      rmSync(localHold, { recursive: true, force: true });
    }
  }
}

// ── Resolve remote ─────────────────────────────────────────────────

export function resolveMemoryRepo(
  explicit: string | undefined,
  deps: SyncDeps = defaultSyncDeps(),
): { ok: true; repo: string } | { ok: false; error: string; code: string } {
  if (explicit?.trim()) {
    return { ok: true, repo: explicit.trim() };
  }
  const saved = loadMemoryRemoteConfig();
  if (saved) return { ok: true, repo: saved.repo };

  // First sync default: {gh-login}/dora-memory
  if (!hasGhCli(deps)) {
    return {
      ok: false,
      code: "E-PRE-001",
      error:
        "No memory remote configured and GitHub CLI (gh) is not installed. Pass --repo owner/name, or install gh and run: gh auth login",
    };
  }
  if (!isGhAuthenticated(deps)) {
    return {
      ok: false,
      code: "E-PRE-002",
      error:
        "No memory remote configured and you are not logged in to GitHub. Run: gh auth login  (or pass --repo owner/name)",
    };
  }
  const login = ghLogin(deps);
  if (!login) {
    return {
      ok: false,
      code: "E-PRE-002",
      error: "Could not read GitHub login via gh. Run: gh auth login  (or pass --repo owner/name)",
    };
  }
  return { ok: true, repo: `${login}/${DEFAULT_REPO_NAME}` };
}

// ── Main sync ──────────────────────────────────────────────────────

/**
 * Sync local `~/.doraval/memory/repo` with the configured remote.
 *
 * First call: ensure gh auth (for GitHub owner/name remotes), create the
 * private repo if needed, clone/init, adopt local files.
 * Subsequent calls: add → commit (if dirty) → pull --rebase → push.
 */
export function syncMemory(opts: SyncOptions = {}): SyncResult {
  const deps = opts.deps ?? defaultSyncDeps();

  if (!hasGitCli(deps)) {
    return {
      ok: false,
      code: "E-PRE-001",
      error: "git is not installed. Install git and retry.",
    };
  }

  const resolved = resolveMemoryRepo(opts.repo, deps);
  if (!resolved.ok) return resolved;

  const repo = resolved.repo;
  const gitUrl = toGitUrl(repo);
  const repoDir = getMemoryRepoDir();
  ensureMemoryDirs();
  if (!existsSync(repoDir)) mkdirSync(repoDir, { recursive: true });

  // GitHub owner/name remotes: ensure auth + private repo exists before clone/push.
  if (isGithubOwnerName(repo)) {
    if (!hasGhCli(deps)) {
      return {
        ok: false,
        code: "E-PRE-001",
        error: "The GitHub CLI (gh) is not installed. Install it, then: gh auth login",
      };
    }
    if (!isGhAuthenticated(deps)) {
      return {
        ok: false,
        code: "E-PRE-002",
        error: "Not logged in to GitHub. Run: gh auth login",
      };
    }
    const created = ensureGithubRepo(repo, deps);
    if (!created.ok) {
      return { ok: false, code: "E-JRN-001", error: created.error };
    }
  }

  const wasGit = isGitRepository(repoDir, deps);
  if (!wasGit) {
    const boot = bootstrapMemoryRepo(repoDir, gitUrl, deps);
    if (!boot.ok) return { ok: false, code: "E-JRN-002", error: boot.error };
  }

  ensureUnionGitattributes(repoDir);

  // Ensure we have a committer identity (no-op if already set globally)
  const email = deps.runGit(["config", "user.email"], { cwd: repoDir });
  if (email.exitCode !== 0 || !email.stdout.trim()) {
    deps.runGit(["config", "user.email", "doraval@local"], { cwd: repoDir });
    deps.runGit(["config", "user.name", "doraval"], { cwd: repoDir });
  }

  let committed = false;
  let pulled = false;
  let pushed = false;

  let r = deps.runGit(["add", "-A"], { cwd: repoDir });
  let check = gitOk(r, "git add");
  if (!check.ok) return { ok: false, code: "E-JRN-003", error: check.error };

  if (hasUncommittedChanges(repoDir, deps)) {
    const msg = opts.message?.trim() || DEFAULT_COMMIT;
    r = deps.runGit(["commit", "-m", msg], { cwd: repoDir });
    check = gitOk(r, "git commit");
    if (!check.ok) return { ok: false, code: "E-JRN-003", error: check.error };
    committed = true;
  }

  // pull --rebase (skip if no upstream yet — bootstrap already pushed)
  const branch = currentBranch(repoDir, deps);
  const upstream = deps.runGit(["rev-parse", "--abbrev-ref", "@{u}"], { cwd: repoDir });
  if (upstream.exitCode !== 0) {
    // Set upstream if origin exists
    const hasOrigin = deps.runGit(["remote", "get-url", "origin"], { cwd: repoDir });
    if (hasOrigin.exitCode === 0) {
      r = deps.runGit(["push", "-u", "origin", branch], { cwd: repoDir });
      check = gitOk(r, "git push -u");
      if (!check.ok) return { ok: false, code: "E-JRN-004", error: check.error };
      pushed = true;
    }
  } else {
    r = deps.runGit(["pull", "--rebase", "origin", branch], { cwd: repoDir });
    if (r.exitCode !== 0) {
      // Try to abort a stuck rebase for cleanliness
      deps.runGit(["rebase", "--abort"], { cwd: repoDir });
      return {
        ok: false,
        code: "E-JRN-005",
        error: `git pull --rebase failed: ${(r.stderr || r.stdout).trim()}. Resolve conflicts in ${repoDir} and re-run dora memory sync.`,
      };
    }
    pulled = true;

    r = deps.runGit(["push", "origin", branch], { cwd: repoDir });
    check = gitOk(r, "git push");
    if (!check.ok) return { ok: false, code: "E-JRN-004", error: check.error };
    pushed = true;
  }

  saveMemoryRemoteConfig(repo);

  const parts: string[] = [];
  if (!wasGit) parts.push("bootstrapped");
  if (committed) parts.push("committed");
  if (pulled) parts.push("pulled");
  if (pushed) parts.push("pushed");
  if (parts.length === 0) parts.push("already up to date");

  return {
    ok: true,
    repo,
    gitUrl,
    committed,
    pulled,
    pushed,
    bootstrapped: !wasGit,
    message: parts.join(", "),
  };
}
