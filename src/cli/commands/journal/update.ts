import { defineCommand } from "citty";
import { existsSync } from "fs";
import pc from "picocolors";
import { join } from "path";
import {
  readConfig,
  resolveProjectName,
  getJournalsDir,
  ensureDoravalDirs,
  sanitizeProjectName,
} from "../../../core/journal-config.js";
import {
  ensureGhCliOrExit,
  refreshLocalJournalFile,
} from "../../../core/journal-remote.js";

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
    ensureGhCliOrExit();

    const config = await readConfig();
    if (!config?.journal.repo) {
      console.error(
        `${pc.red("✗")} No journal repo configured. Run ${pc.dim("dora init")} (or ${pc.dim("doraval journal init")}) first.`
      );
      process.exit(1);
    }

    const journalRepo = config.journal.repo;

    ensureDoravalDirs();
    const journalsDir = getJournalsDir();

    console.error(`\n  ${pc.bold(pc.white("dora journal update"))} — ${pc.dim(pc.gray(journalRepo))}\n`);

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
          console.error(`${pc.red("✗")} Invalid project name: ${project}`);
          process.exit(1);
        }
      }
    }

    // Always refresh global first (cross-project principles)
    const globalLocal = join(journalsDir, "global.md");
    const gotGlobal = await refreshLocalJournalFile(journalRepo, "global.md", globalLocal);
    if (gotGlobal) {
      console.error(`  ${pc.green("✓")} global.md`);
    } else {
      console.error(`  ${pc.dim("·")} global.md ${pc.dim("(not present on remote)")}`);
    }

    if (projectsToUpdate.length === 0) {
      if (args.all) {
        console.error(`\n  ${pc.dim(pc.gray("No projects registered."))}\n`);
      } else {
        console.error(
          `\n  ${pc.yellow("⚠")} No project mapping found.\n` +
            `  Run ${pc.dim("dora init")} or pass ${pc.dim("--project <name>")} / ${pc.dim("--all")}.\n`
        );
      }
      return;
    }

    for (const project of projectsToUpdate) {
      const remotePath = `projects/${project}.md`;
      const localPath = join(journalsDir, `${project}.md`);

      const got = await refreshLocalJournalFile(journalRepo, remotePath, localPath);
      if (got) {
        console.error(`  ${pc.green("✓")} ${remotePath}`);
      } else {
        console.error(
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

    console.error(`\n  ${pc.dim(pc.gray("Local cache refreshed for"))} ${pc.bold(pc.white(summary))}.\n`);
  },
});
