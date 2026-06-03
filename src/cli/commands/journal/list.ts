import { defineCommand } from "citty";
import pc from "picocolors";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import {
  readConfig,
  resolveProjectName,
  getJournalsDir,
  getPendingProjectDir,
  sanitizeProjectName,
} from "../../../core/journal-config.js";
import { parseJournalEntries, type JournalEntry } from "../../../core/journal-parse.js";

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
        `${pc.yellow("⚠")} ${pc.yellow("No project mapping found.")}\n\n` +
          `Run ${pc.dim(pc.gray("dora init"))} (or ${pc.dim(pc.gray("doraval journal init"))}) first, or pass ${pc.dim(pc.gray("--project <name>"))}.`
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
      // No local committed mirror yet (common for brand new projects or before first update/sync).
      // We can still show any staged pendings; the error will only be fatal if there are zero staged too.
      raw = "";
    }

    let allEntries = parseJournalEntries(raw);

    if (!args.all) {
      allEntries = allEntries.filter((e) => e.status === "active");
    }

    // Load any locally staged (pending) entries so that "add" then immediate "list"
    // shows the fresh capture (including agent-enriched title/author) without requiring sync first.
    const staged: Array<JournalEntry & { _staged?: boolean }> = [];
    try {
      const pdir = getPendingProjectDir(project);
      if (existsSync(pdir)) {
        const files = readdirSync(pdir).filter((f) => f.endsWith(".md") && f !== ".gitkeep");
        for (const f of files) {
          const txt = await Bun.file(join(pdir, f)).text();
          const parsed = parseJournalEntries(txt);
          for (const e of parsed) {
            (e as any)._staged = true;
            staged.push(e);
          }
        }
      }
    } catch {
      // best effort; don't block list on pending problems
    }

    if (args.format === "json") {
      console.log(JSON.stringify({ project, entries: [...staged, ...allEntries] }, null, 2));
      return;
    }

    // Table output (human friendly) goes to stderr, like other doraval commands
    console.error(`\n  ${pc.bold(pc.white("dora journal list"))} — ${pc.white(project)}  ${pc.dim(pc.gray(`(from ${journalRepo})`))}\n`);

    const hasStaged = staged.length > 0;
    const hasCommitted = allEntries.length > 0;

    // Light hygiene: surface obvious dups (e.g. from previous double-add + sync without cleaning the source journal)
    const seen = new Set<string>();
    const dups: string[] = [];
    for (const e of [...staged, ...allEntries]) {
      if (seen.has(e.title)) dups.push(e.title);
      else seen.add(e.title);
    }
    if (dups.length > 0) {
      const uniqueDups = [...new Set(dups)];
      console.error(`  ${pc.yellow("⚠")} ${pc.yellow("Duplicate titles in this view (clean in your journal repo + update):")} ${uniqueDups.map(t => pc.yellow(`"${t}"`)).join(', ')}\n`);
    }

    if (!hasStaged && !hasCommitted) {
      console.error(`  ${pc.dim(pc.gray("No active entries found for"))} ${pc.bold(pc.white(project))}.\n`);
      console.error(`  Journal repo: ${pc.dim(pc.gray(journalRepo))}`);
      console.error(`  Local file:   ${pc.dim(pc.gray(projectFile))}\n`);
      console.error(
        `  ${pc.dim(pc.gray("This is normal for a freshly initialized project."))}\n` +
          `  Use ${pc.dim(pc.gray("dora journal add"))} to propose decisions.\n` +
          `  They will be staged locally until you run ${pc.dim(pc.gray("dora journal sync"))}.\n`
      );
      console.error(
        `  If you expect content, try: ${pc.dim(pc.gray(`dora journal update`))}\n`
      );
      return;
    }

    // Helper to render one entry (colors agent authors, marks staged)
    function printEntry(entry: JournalEntry & { _staged?: boolean }) {
      const pb = entry.pushback ?? 0;
      let pbColor = pc.green;
      // Color the pushback score to draw attention to entries that received heavy agent critique.
      // Red is reserved for high-severity (lots of pushback); yellow medium; green low. This is one of the few
      // intentional uses of red outside of hard errors (✗) in the CLI.
      if (pb >= 7) pbColor = pc.red;
      else if (pb >= 4) pbColor = pc.yellow;

      const tagsStr = (entry.tags || []).join(", ") || pc.dim("(none)");
      const statusNote =
        entry.status !== "active" ? pc.dim(` [${entry.status}]`) : "";
      const stagedNote = entry._staged ? pc.dim(" (staged)") : "";

      console.error(
        `  ${pbColor(String(pb).padStart(2))}  ${pc.bold(pc.white(entry.title))}${statusNote}${stagedNote}`
      );
      console.error(`      ${pc.dim(pc.gray("tags:"))} ${pc.gray(tagsStr)}`);

      const by = entry.author?.startsWith("agent:") ? pc.cyan(entry.author) : entry.author || "human";
      console.error(`      ${pc.dim(pc.gray("by:"))} ${pc.gray(by)}  ${pc.dim(pc.gray("on"))} ${pc.gray(entry.date)}`);

      // Show a compact rationale/note preview so you can see the phrasing (and whether the agent improved it) directly in list
      const rat = (entry.rationale || '').replace(/\s+/g, ' ').trim();
      if (rat) {
        const preview = rat.length > 88 ? rat.slice(0, 85) + pc.dim(pc.gray('…')) : rat;
        console.error(`      ${pc.dim(pc.gray(preview))}`);
      }
      console.error(''); // vertical space between entries
    }

    if (hasStaged) {
      console.error(`  ${pc.yellow("●")} ${pc.bold(pc.white("Staged / pending"))} (not yet in remote; run ${pc.dim(pc.gray("dora journal sync"))} to publish):\n`);
      for (const entry of staged) {
        printEntry(entry);
      }
      if (hasCommitted) console.error(""); // small spacer before committed section
    }

    if (hasCommitted) {
      if (hasStaged) {
        console.error(`  ${pc.dim(pc.gray("Committed (from local cache):"))}\n`);
      }
      for (const entry of allEntries) {
        printEntry(entry);
      }
    }

    const totalShown = staged.length + allEntries.length;
    console.error(`  ${pc.dim(pc.gray(`${totalShown} entries shown from ${journalRepo}.`))}\n`);

    process.exit(0);
  },
});
