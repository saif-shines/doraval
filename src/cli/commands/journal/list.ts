import { defineCommand } from "citty";
import pc from "picocolors";
import { join } from "path";
import {
  readConfig,
  resolveProjectName,
  getJournalsDir,
  sanitizeProjectName,
} from "../../../core/journal-config.js";
import { parseJournalEntries } from "../../../core/journal-parse.js";

export default defineCommand({
  meta: {
    name: "list",
    description: "List active journal entries for the current project",
  },
  args: {
    project: {
      type: "string",
      alias: "p",
      description: "Project name (defaults to directory-based mapping)",
    },
    all: {
      type: "boolean",
      description: "Include non-active entries (superseded/retired)",
      default: false,
    },
    format: {
      type: "string",
      alias: "f",
      description: "Output format (table or json)",
      default: "table",
    },
  },

  async run({ args }) {
    const config = await readConfig();

    let project = args.project as string | undefined;
    if (!project) {
      project = resolveProjectName(config) ?? undefined;
    }

    if (project) {
      project = sanitizeProjectName(project);
    }

    if (!project) {
      console.error(
        `${pc.yellow("⚠")} No project mapping found.\n\n` +
          `Run ${pc.dim("doraval journal init")} first, or pass ${pc.dim("--project <name>")}.`
      );
      process.exit(1);
    }

    const journalRepo = config?.journal.repo ?? "(unknown)";

    // Read from the canonical journals directory (respects DORAVAL_HOME)
    const journalsDir = getJournalsDir();
    const projectFile = join(journalsDir, `${project}.md`);
    const globalFile = join(journalsDir, "global.md");

    let raw = "";
    try {
      raw = await Bun.file(projectFile).text();
    } catch {
      console.error(
        `${pc.yellow("⚠")} Could not find journal file for project "${project}".\n` +
          `Expected: ${pc.dim(projectFile)}\n` +
          `Journal repo: ${pc.dim(journalRepo)}\n\n` +
          `Run ${pc.dim("doraval journal update")} (or ${pc.dim("doraval journal init --refresh")}) to fetch it.`
      );
      process.exit(1);
    }

    let allEntries = parseJournalEntries(raw);

    if (!args.all) {
      allEntries = allEntries.filter((e) => e.status === "active");
    }

    if (args.format === "json") {
      console.log(JSON.stringify({ project, entries: allEntries }, null, 2));
      return;
    }

    // Table output (human friendly) goes to stderr, like other doraval commands
    console.error(`\n  ${pc.bold("doraval journal list")} — ${project}  ${pc.dim(`(from ${journalRepo})`)}\n`);

    if (allEntries.length === 0) {
      console.error(`  ${pc.dim("No active entries found for")} ${pc.bold(project)}.\n`);
      console.error(`  Journal repo: ${pc.dim(journalRepo)}`);
      console.error(`  Local file:   ${pc.dim(projectFile)}\n`);
      console.error(
        `  ${pc.dim("This is normal for a freshly initialized project.")}\n` +
          `  Use ${pc.dim("doraval journal add")} to propose decisions.\n` +
          `  They will be staged locally until you run ${pc.dim("doraval journal sync")}.\n`
      );
      console.error(
        `  If you expect content, try: ${pc.dim(`doraval journal update`)}\n`
      );
      return;
    }

    for (const entry of allEntries) {
      const pb = entry.pushback;
      let pbColor = pc.green;
      if (pb >= 7) pbColor = pc.red;
      else if (pb >= 4) pbColor = pc.yellow;

      const scopeStr = entry.scope.join(", ");
      const statusNote =
        entry.status !== "active" ? pc.dim(` [${entry.status}]`) : "";

      console.error(
        `  ${pbColor(String(pb).padStart(2))}  ${pc.bold(entry.title)}${statusNote}`
      );
      console.error(`      ${pc.dim("scope:")} ${scopeStr}`);
      console.error(`      ${pc.dim("by:")} ${entry.author}  ${pc.dim("on")} ${entry.date}\n`);
    }

    console.error(`  ${pc.dim(`${allEntries.length} entries shown from ${journalRepo}.`)}\n`);
  },
});
