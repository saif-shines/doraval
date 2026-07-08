import { defineCommand } from "citty";
import { existsSync } from "fs";
import { basename, join } from "path";
import { spawnSync } from "bun";
import pc from "picocolors";
import { ui } from "../../out.js";
import {
  readConfig,
  writeConfig,
  ensureDoravalDirs,
  getJournalsDir,
  sanitizeProjectName,
  type JournalConfig,
} from "../../../core/journal-config.js";
import {
  ensureGhCli,
  refreshLocalJournalFile,
  getGitRemoteOwner,
  ghUser,
  repoExists,
} from "../../../core/journal-remote.js";
import { prompt } from "../../prompt.js";
import { exit } from "../../render/exit.js";

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
    ui.write(
      `\n  ${pc.bold(pc.white("dora journal init"))} (or top-level ${pc.dim(pc.gray("dora init"))}) — Set up decision memory (journal for scaling AI context)\n`
    );

    // ── 0. Check gh CLI is available ───────────────────────────────
    const ghCheck = ensureGhCli();
    if (!ghCheck.ok) {
      ui.write(`  ${pc.red("✗")} ${pc.white("The GitHub CLI (")}${pc.bold("gh")}${pc.white(") is not installed.")}\n`);
      ui.write(`  doraval uses ${pc.bold("gh")} to fetch and sync journal files with GitHub.\n`);
      ui.write(`  Install it:\n`);
      ui.write(`    macOS:   ${pc.dim("brew install gh")}`);
      ui.write(`    Linux:   ${pc.dim("https://github.com/cli/cli/blob/trunk/docs/install_linux.md")}`);
      ui.write(`    Windows: ${pc.dim("winget install --id GitHub.cli")}\n`);
      ui.write(`  Then authenticate: ${pc.dim("gh auth login")}\n`);
      return await exit(1);
    }

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
        ui.write(
          `  ${pc.yellow("⚠")} Not logged in to GitHub. Run ${pc.dim("gh auth login")} first.\n`
        );
        return await exit(1);
      }

      // If we already have a config, prefer the previously used journal repo as default.
      const existingConfig = await readConfig();
      if (existingConfig?.journal.repo) {
        defaultRepo = existingConfig.journal.repo;
        sourceNote = `  ${pc.dim("(from your previous decision memory setup)")}\n`;
      }

      repo = await prompt(
        sourceNote ? "Journal repo (owner/name, from your previous setup)" : "Journal repo (owner/name)",
        defaultRepo
      );
    }

    // ── 2. Resolve project name ────────────────────────────────────
    // Precedence: --project flag > DORAVAL_PROJECT env > basename of cwd
    let project = (args.project as string | undefined) || process.env.DORAVAL_PROJECT;
    if (!project) {
      const defaultProject = basename(process.cwd());
      project = await prompt("Project name", defaultProject);
    }

    // Sanitize for safety (filesystem + GitHub paths)
    project = sanitizeProjectName(project);

    // ── 3. Verify repo exists on GitHub ───────────────────────────
    if (!repoExists(repo!)) {
      ui.write(
        `  ${pc.red("✗")} Repository ${pc.bold(pc.white(repo!))} not found on GitHub.\n`
      );
      ui.write(`  Create it first:\n`);
      ui.write(
        `    ${pc.dim(`gh repo create ${repo} --private --description "Personal journal for agent decisions"`)}\n`
      );
      ui.write(
        `  The repo should be private. doraval will populate it on first ${pc.dim("dora journal sync")}.\n`
      );
      return await exit(1);
    }

    // ── 4. Check if already initialized ────────────────────────────
    const existing = await readConfig();
    const alreadyRegistered = existing?.journal.projects[project];
    const isRefresh = alreadyRegistered && args.refresh;

    if (alreadyRegistered && !isRefresh) {
      ui.write(
        `  ${pc.yellow("⚠")} Project ${pc.bold(pc.white(project))} is already registered.\n`
      );
      ui.write(
        `  Repo:   ${pc.gray(existing.journal.repo)}`
      );
      ui.write(
        `  Remote: ${existing.journal.projects[project]?.remote_path}\n`
      );
      ui.write(
        `  To refresh local files, run: ${pc.dim(pc.gray(`dora journal update`))}\n` +
          `  (init --refresh still works for compatibility.)\n` +
          `  Or remove the project from ${pc.dim(pc.gray("~/.doraval/config.yml"))} to fully re-initialize.\n`
      );
      return await exit(0);
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
    ui.write(`  ${pc.dim(pc.gray(`${actionLabel} journal files from`))} ${pc.gray(effectiveRepo)}${pc.dim(pc.gray("..."))}\n`);

    const globalDest = join(journalsDir, "global.md");
    const refreshGlobalRes = await refreshLocalJournalFile(effectiveRepo, "global.md", globalDest);
    let wroteGlobal: boolean;
    if (!refreshGlobalRes.ok) {
      if (refreshGlobalRes.isNotFound) {
        wroteGlobal = false;
      } else {
        ui.write(`  ${pc.red("✗")} Failed to fetch global.md from ${effectiveRepo}:`);
        ui.write(refreshGlobalRes.error);
        return await exit(1);
      }
    } else {
      wroteGlobal = refreshGlobalRes.value;
    }
    if (wroteGlobal) {
      ui.write(`  ${pc.green("✓")} global.md`);
    } else {
      ui.write(`  ${pc.dim("·")} global.md ${pc.dim("(not found — will be created on first sync)")}`);
      await Bun.write(globalDest, "# Global Journal\n\nCross-project principles.\n");
    }

    const refreshProjectRes = await refreshLocalJournalFile(effectiveRepo, remotePath, localPath);
    let wroteProject: boolean;
    if (!refreshProjectRes.ok) {
      if (refreshProjectRes.isNotFound) {
        wroteProject = false;
      } else {
        ui.write(`  ${pc.red("✗")} Failed to fetch ${remotePath} from ${effectiveRepo}:`);
        ui.write(refreshProjectRes.error);
        return await exit(1);
      }
    } else {
      wroteProject = refreshProjectRes.value;
    }
    if (wroteProject) {
      ui.write(`  ${pc.green("✓")} ${remotePath}`);
    } else {
      ui.write(`  ${pc.dim("·")} ${remotePath} ${pc.dim("(not found — will be created on first sync)")}`);
      await Bun.write(localPath, `# ${project} Journal\n\nProject-specific decisions.\n`);
    }

    // ── 8. Write config ────────────────────────────────────────────
    await writeConfig(config);

    ui.write(
      `\n  ${pc.green("✓")} Project ${pc.bold(pc.white(project))} registered to ${pc.bold(pc.white(repo!))}.\n`
    );
    ui.write(`  Config:   ${pc.dim(pc.gray("~/.doraval/config.yml"))}`);
    ui.write(`  Journals: ${pc.dim(pc.gray("~/.doraval/journals/"))}`);
    ui.write(`  Pending:  ${pc.dim(pc.gray("~/.doraval/pending/"))}\n`);
    ui.write(
      `  Use ${pc.dim(pc.gray("dora journal add"))} to propose decisions and ${pc.dim(pc.gray("dora journal list"))} to view them.\n`
    );

    await exit(0);
  },
});