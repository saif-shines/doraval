import { defineCommand } from "citty";
import { existsSync } from "fs";
import pc from "picocolors";
import { ui } from "../../out.js";
import { join } from "path";
import {
  readConfig,
  resolveProjectName,
  getJournalsDir,
  ensureDoravalDirs,
  sanitizeProjectName,
} from "../../../core/journal-config.js";
import {
  ensureGhCli,
  refreshLocalJournalFile,
} from "../../../core/journal-remote.js";
import { exit } from "../../render/exit.js";

export default defineCommand({
  meta: {
    name: "update",
    description: "Refresh local journal cache from the remote GitHub repo",
  },
  args: {
    project: {
      type: "string",
      alias: "p",
      description: "Project name (defaults to directory-based mapping)",
    },
    all: {
      type: "boolean",
      description: "Refresh all registered projects (and global.md)",
      default: false,
    },
  },

  async run({ args }) {
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

    const config = await readConfig();
    if (!config?.journal.repo) {
      ui.write(
        `${pc.red("✗")} No journal repo configured. Run ${pc.dim("dora init")} (or ${pc.dim("doraval journal init")}) first.`
      );
      return await exit(1);
    }

    const journalRepo = config.journal.repo;

    ensureDoravalDirs();
    const journalsDir = getJournalsDir();

    ui.write(`\n  ${pc.bold(pc.white("dora journal update"))} — ${pc.dim(pc.gray(journalRepo))}\n`);

    // Determine which projects to refresh
    const projectsToUpdate: string[] = [];
    if (args.all) {
      for (const name of Object.keys(config.journal.projects)) {
        try {
          projectsToUpdate.push(sanitizeProjectName(name));
        } catch {
          // skip unsafe names
        }
      }
    } else {
      let project = args.project as string | undefined;
      if (!project) {
        project = resolveProjectName(config) ?? undefined;
      }
      if (project) {
        try {
          projectsToUpdate.push(sanitizeProjectName(project));
        } catch {
          ui.write(`${pc.red("✗")} Invalid project name: ${project}`);
          return await exit(1);
        }
      }
    }

    // Always refresh global first (cross-project principles)
    const globalLocal = join(journalsDir, "global.md");
    const refreshGlobalRes = await refreshLocalJournalFile(journalRepo, "global.md", globalLocal);
    let gotGlobal: boolean;
    if (!refreshGlobalRes.ok) {
      if (refreshGlobalRes.isNotFound) {
        gotGlobal = false;
      } else {
        ui.write(`${pc.red("✗")} Failed to fetch global.md from ${journalRepo}:`);
        ui.write(refreshGlobalRes.error);
        return await exit(1);
      }
    } else {
      gotGlobal = refreshGlobalRes.value;
    }
    if (gotGlobal) {
      ui.write(`  ${pc.green("✓")} global.md`);
    } else {
      ui.write(`  ${pc.dim("·")} global.md ${pc.dim("(not present on remote)")}`);
    }

    if (projectsToUpdate.length === 0) {
      if (args.all) {
        ui.write(`\n  ${pc.dim(pc.gray("No projects registered."))}\n`);
      } else {
        ui.write(
          `\n  ${pc.yellow("⚠")} No project mapping found.\n` +
            `  Run ${pc.dim("dora init")} or pass ${pc.dim("--project <name>")} / ${pc.dim("--all")}.\n`
        );
      }
      return;
    }

    for (const project of projectsToUpdate) {
      const remotePath = `projects/${project}.md`;
      const localPath = join(journalsDir, `${project}.md`);

      const refreshRes = await refreshLocalJournalFile(journalRepo, remotePath, localPath);
      let got: boolean;
      if (!refreshRes.ok) {
        if (refreshRes.isNotFound) {
          got = false;
        } else {
          ui.write(`${pc.red("✗")} Failed to fetch ${remotePath} from ${journalRepo}:`);
          ui.write(refreshRes.error);
          return await exit(1);
        }
      } else {
        got = refreshRes.value;
      }
      if (got) {
        ui.write(`  ${pc.green("✓")} ${remotePath}`);
      } else {
        ui.write(
          `  ${pc.dim("·")} ${remotePath} ${pc.dim("(not present on remote — will be created on first sync)")}`
        );
        // Ensure a minimal local file exists so that `list` and future `check` don't fail hard.
        if (!existsSync(localPath)) {
          await Bun.write(localPath, `# ${project} Journal\n\nProject-specific decisions.\n`);
        }
      }
    }

    const summary =
      args.all && projectsToUpdate.length > 1
        ? `${projectsToUpdate.length} projects + global`
        : projectsToUpdate.length === 1
        ? projectsToUpdate[0]
        : "journals";

    ui.write(`\n  ${pc.dim(pc.gray("Local cache refreshed for"))} ${pc.bold(pc.white(summary))}.\n`);
  },
});
