import { defineCommand } from "citty";
import { existsSync } from "fs";
import { basename, join } from "path";
import { spawnSync } from "bun";
import pc from "picocolors";
import {
  readConfig,
  writeConfig,
  ensureDoravalDirs,
  getJournalsDir,
  sanitizeProjectName,
  type JournalConfig,
} from "../../../core/journal-config.js";
import {
  ensureGhCliOrExit,
  refreshLocalJournalFile,
} from "../../../core/journal-remote.js";

// ── Helpers ────────────────────────────────────────────────────────

function ghUser(): string | null {
  const result = spawnSync(["gh", "api", "user", "--jq", ".login"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) return null;
  return result.stdout.toString().trim() || null;
}

/**
 * Try to extract the owner from the current git repo's origin remote.
 * Supports both https and ssh URL formats.
 */
export function getGitRemoteOwner(): string | null {
  const result = spawnSync(["git", "config", "--get", "remote.origin.url"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) return null;

  const url = result.stdout.toString().trim();
  if (!url) return null;

  // https://github.com/owner/repo.git
  // git@github.com:owner/repo.git
  const match = url.match(/[:/]([^/]+)\/([^/.]+)(\.git)?$/);
  return match ? match[1] : null;
}

function repoExists(repo: string): boolean {
  const result = spawnSync(
    ["gh", "api", `repos/${repo}`, "--jq", ".full_name"],
    { stdout: "pipe", stderr: "pipe" }
  );
  return result.exitCode === 0 && result.stdout.toString().trim().length > 0;
}

function prompt(label: string, fallback: string): string {
  // label should include leading spacing if desired, e.g. "  >"
  process.stderr.write(`${label} ${pc.dim(`(${fallback})`)} `);
  const buf = new Uint8Array(1024);
  const n = require("fs").readSync(0, buf);
  const input = new TextDecoder().decode(buf.subarray(0, n)).trim();
  return input || fallback;
}

// ── Command ────────────────────────────────────────────────────────

export default defineCommand({
  meta: {
    name: "init",
    description: "Register a project and link it to your journal repo",
  },
  args: {
    repo: {
      type: "string",
      alias: "r",
      description: "Journal repo (owner/name). Smart default from git remote or gh account. Env: DORAVAL_JOURNAL_REPO",
    },
    project: {
      type: "string",
      alias: "p",
      description: "Project name (default: basename of current directory)",
    },
    refresh: {
      type: "boolean",
      description: "Re-fetch journal files even if the project is already registered",
      default: false,
    },
  },

  async run({ args }) {
    console.error(
      `\n  ${pc.bold("doraval journal init")} — Set up your journal\n`
    );

    // ── 0. Check gh CLI is available ───────────────────────────────
    ensureGhCliOrExit();

    // ── 1. Resolve repo ────────────────────────────────────────────
    // Precedence: --repo flag > DORAVAL_JOURNAL_REPO env > smart default
    let repo = (args.repo as string | undefined) || process.env.DORAVAL_JOURNAL_REPO;

    if (!repo) {
      const gitOwner = getGitRemoteOwner();
      const ghLogin = ghUser();

      // Build a smart default. Prefer git remote owner when available.
      let defaultRepo: string;
      let sourceNote = "";

      if (gitOwner) {
        defaultRepo = `${gitOwner}/${gitOwner}.md`;
        if (ghLogin && ghLogin !== gitOwner) {
          sourceNote = `  ${pc.dim("(from git remote; your active gh account is " + ghLogin + ")")}\n`;
        } else {
          sourceNote = `  ${pc.dim("(from git remote)")}\n`;
        }
      } else if (ghLogin) {
        defaultRepo = `${ghLogin}/${ghLogin}.md`;
        sourceNote = `  ${pc.dim("(from your active gh account)")}\n`;
      } else {
        console.error(
          `  ${pc.yellow("⚠")} Not logged in to GitHub. Run ${pc.dim("gh auth login")} first.\n`
        );
        process.exit(1);
      }

      // If we already have a config, prefer the previously used journal repo as default.
      const existingConfig = await readConfig();
      if (existingConfig?.journal.repo) {
        defaultRepo = existingConfig.journal.repo;
        sourceNote = `  ${pc.dim("(from your previous journal setup)")}\n`;
      }

      console.error(`  Journal repo ${pc.dim("(owner/name)")}`);
      if (sourceNote) console.error(sourceNote);
      repo = prompt("  >", defaultRepo);
    }

    // ── 2. Resolve project name ────────────────────────────────────
    // Precedence: --project flag > DORAVAL_PROJECT env > basename of cwd
    let project = (args.project as string | undefined) || process.env.DORAVAL_PROJECT;
    if (!project) {
      const defaultProject = basename(process.cwd());
      project = prompt("  Project name", defaultProject);
    }

    // Sanitize for safety (filesystem + GitHub paths)
    project = sanitizeProjectName(project);

    // ── 3. Verify repo exists on GitHub ───────────────────────────
    if (!repoExists(repo!)) {
      console.error(
        `  ${pc.red("✗")} Repository ${pc.bold(repo!)} not found on GitHub.\n`
      );
      console.error(`  Create it first:\n`);
      console.error(
        `    ${pc.dim(`gh repo create ${repo} --private --description "Personal journal for agent decisions"`)}\n`
      );
      console.error(
        `  The repo should be private. doraval will populate it on first ${pc.dim("doraval journal sync")}.\n`
      );
      process.exit(1);
    }

    // ── 4. Check if already initialized ────────────────────────────
    const existing = await readConfig();
    const alreadyRegistered = existing?.journal.projects[project];
    const isRefresh = alreadyRegistered && args.refresh;

    if (alreadyRegistered && !isRefresh) {
      console.error(
        `  ${pc.yellow("⚠")} Project ${pc.bold(project)} is already registered.\n`
      );
      console.error(
        `  Repo:   ${existing.journal.repo}`
      );
      console.error(
        `  Remote: ${existing.journal.projects[project].remote_path}\n`
      );
      console.error(
        `  To refresh local files, run: ${pc.dim(`doraval journal update`)}\n` +
          `  (init --refresh still works for compatibility.)\n` +
          `  Or remove the project from ${pc.dim("~/.doraval/config.yml")} to fully re-initialize.\n`
      );
      process.exit(0);
    }

    // ── 5. Prepare paths and config ────────────────────────────────
    const journalsDir = getJournalsDir();
    const remotePath = `projects/${project}.md`;
    const localPath = join(journalsDir, `${project}.md`);

    // On refresh, prefer the already-stored repo unless --repo was explicitly passed
    const effectiveRepo = isRefresh && !args.repo ? existing!.journal.repo : repo!;

    const config: JournalConfig = existing ?? {
      journal: { repo: effectiveRepo, projects: {} },
    };
    config.journal.repo = effectiveRepo;
    config.journal.projects[project] = {
      remote_path: remotePath,
      local_path: localPath,
    };

    // ── 6. Create directories ──────────────────────────────────────
    ensureDoravalDirs();

    // ── 7. Fetch / ensure journal files ────────────────────────────
    const actionLabel = isRefresh ? "Refreshing" : "Fetching";
    console.error(`  ${pc.dim(`${actionLabel} journal files from`)} ${effectiveRepo}${pc.dim("...")}\n`);

    const globalDest = join(journalsDir, "global.md");
    const wroteGlobal = await refreshLocalJournalFile(effectiveRepo, "global.md", globalDest);
    if (wroteGlobal) {
      console.error(`  ${pc.green("✓")} global.md`);
    } else {
      console.error(`  ${pc.dim("·")} global.md ${pc.dim("(not found — will be created on first sync)")}`);
      await Bun.write(globalDest, "# Global Journal\n\nCross-project principles.\n");
    }

    const wroteProject = await refreshLocalJournalFile(effectiveRepo, remotePath, localPath);
    if (wroteProject) {
      console.error(`  ${pc.green("✓")} ${remotePath}`);
    } else {
      console.error(`  ${pc.dim("·")} ${remotePath} ${pc.dim("(not found — will be created on first sync)")}`);
      await Bun.write(localPath, `# ${project} Journal\n\nProject-specific decisions.\n`);
    }

    // ── 8. Write config ────────────────────────────────────────────
    await writeConfig(config);

    console.error(
      `\n  ${pc.green("✓")} Project ${pc.bold(project)} registered to ${pc.bold(repo!)}.\n`
    );
    console.error(`  Config:   ${pc.dim("~/.doraval/config.yml")}`);
    console.error(`  Journals: ${pc.dim("~/.doraval/journals/")}`);
    console.error(`  Pending:  ${pc.dim("~/.doraval/pending/")}\n`);
    console.error(
      `  Use ${pc.dim("doraval journal add")} to propose decisions and ${pc.dim("doraval journal list")} to view them.\n`
    );

    process.exit(0);
  },
});