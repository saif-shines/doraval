/**
 * Shared journal read/write helpers.
 * Consumed by: dora ui (web REST), TUI panes, journal/list.ts, journal/add.ts.
 *
 * Rules:
 * - Pure async I/O over core fns — no UI imports, no cli/out.ts.
 * - No side-effects beyond the ~/.doraval tree.
 */
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import {
  getJournalsDir,
  getPendingProjectDir,
  ensureDoravalDirs,
} from "../journal-config.js";
import { parseJournalEntries, type JournalEntry } from "../journal-parse.js";

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}

export interface EntryWithMeta extends JournalEntry {
  _source?: "global" | "project" | "staged";
  _staged?: boolean;
  _filename?: string;
}

/**
 * Load all entries for a project: global + committed + staged.
 * Used by the web dashboard and TUI Journal pane.
 */
export async function loadAllEntries(
  project: string | null
): Promise<{ committed: EntryWithMeta[]; staged: EntryWithMeta[] }> {
  const journalsDir = getJournalsDir();
  const committed: EntryWithMeta[] = [];

  // Global
  const globalPath = join(journalsDir, "global.md");
  if (existsSync(globalPath)) {
    try {
      const raw = await Bun.file(globalPath).text();
      parseJournalEntries(raw).forEach((e) =>
        committed.push({ ...e, _source: "global" })
      );
    } catch {}
  }

  // Project committed
  if (project) {
    const projPath = join(journalsDir, `${project}.md`);
    if (existsSync(projPath)) {
      try {
        const raw = await Bun.file(projPath).text();
        parseJournalEntries(raw).forEach((e) =>
          committed.push({ ...e, _source: "project" })
        );
      } catch {}
    }
  }

  // Staged / pending
  const staged: EntryWithMeta[] = [];
  try {
    const pdir = project ? getPendingProjectDir(project) : null;
    if (pdir && existsSync(pdir)) {
      const files = readdirSync(pdir).filter(
        (f) => f.endsWith(".md") && f !== ".gitkeep"
      );
      for (const f of files) {
        const txt = await Bun.file(join(pdir, f)).text();
        parseJournalEntries(txt).forEach((e) =>
          staged.push({ ...e, _staged: true, _source: "staged", _filename: f })
        );
      }
    }
  } catch {}

  return { committed, staged };
}

/**
 * Load only project-scoped committed + staged entries (no global).
 * Used by journal/list.ts where global entries are not shown.
 */
export async function loadProjectEntries(project: string): Promise<{
  committed: EntryWithMeta[];
  staged: EntryWithMeta[];
}> {
  const journalsDir = getJournalsDir();
  const committed: EntryWithMeta[] = [];

  const projPath = join(journalsDir, `${project}.md`);
  if (existsSync(projPath)) {
    try {
      const raw = await Bun.file(projPath).text();
      parseJournalEntries(raw).forEach((e) =>
        committed.push({ ...e, _source: "project" })
      );
    } catch {}
  }

  const staged: EntryWithMeta[] = [];
  try {
    const pdir = getPendingProjectDir(project);
    if (existsSync(pdir)) {
      const files = readdirSync(pdir).filter(
        (f) => f.endsWith(".md") && f !== ".gitkeep"
      );
      for (const f of files) {
        const txt = await Bun.file(join(pdir, f)).text();
        parseJournalEntries(txt).forEach((e) =>
          staged.push({ ...e, _staged: true, _source: "staged", _filename: f })
        );
      }
    }
  } catch {}

  return { committed, staged };
}

export interface PendingEntryInput {
  title: string;
  pushback: number;
  tags: string[];
  rationale: string;
  author?: string;
}

export async function writePendingEntry(
  project: string,
  input: PendingEntryInput
): Promise<{ filePath: string; filename: string }> {
  ensureDoravalDirs();
  const pendingDir = getPendingProjectDir(project);
  if (!existsSync(pendingDir)) {
    await Bun.write(join(pendingDir, ".gitkeep"), "");
  }

  const date = new Date().toISOString().split("T")[0];
  const slug = slugify(input.title);
  const filename = `${date}-${slug}.md`;
  const filePath = join(pendingDir, filename);

  const content = `## ${input.title}

\`\`\`yaml
pushback: ${input.pushback}
tags: [${input.tags.join(", ")}]
author: ${input.author || "human"}
date: ${date}
status: active
\`\`\`

${input.rationale}
`;

  await Bun.write(filePath, content);
  return { filePath, filename };
}
