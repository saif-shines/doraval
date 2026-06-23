import { defineCommand } from "citty";
import { existsSync } from "fs";
import { join, resolve as resolvePath } from "path";
import pc from "picocolors";
import { ui } from "../../out.js";
import {
  readConfig,
  resolveProjectName,
  getJournalsDir,
  sanitizeProjectName,
} from "../../../core/journal-config.js";
import { parseJournalEntries, type JournalEntry } from "../../../core/journal-parse.js";
import {
  buildJournalHookCommand,
  journalHookGroup,
} from "../../../core/journal-hook.js";

export function formatJournalHookJson(contextText: string): string {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: contextText,
    },
  });
}

export interface ContextOptions {
  minPushback?: number;
  full?: boolean;
  noGlobal?: boolean;
}

function truncate(text: string, max = 180): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1) + "…";
}

function groupByPushback(entries: JournalEntry[]) {
  const strong: JournalEntry[] = [];
  const friction: JournalEntry[] = [];
  const nudge: JournalEntry[] = [];

  for (const e of entries) {
    const pb = e.pushback ?? 0;
    if (pb >= 7) strong.push(e);
    else if (pb >= 4) friction.push(e);
    else nudge.push(e);
  }

  // Highest pushback first within each group
  const byPush = (a: JournalEntry, b: JournalEntry) =>
    (b.pushback ?? 0) - (a.pushback ?? 0);

  return {
    strong: strong.sort(byPush),
    friction: friction.sort(byPush),
    nudge: nudge.sort(byPush),
  };
}

export function generateJournalContext(
  entries: JournalEntry[],
  project: string | null,
  opts: ContextOptions = {}
): string {
  const minPb = opts.minPushback ?? 1;
  const showFull = !!opts.full;
  const includeGlobal = !opts.noGlobal;

  let filtered = entries.filter((e) => {
    const pb = e.pushback ?? 0;
    const isActive = (e.status || "active") === "active";
    return isActive && pb >= minPb;
  });

  if (!includeGlobal) {
    // In current design we don't tag global vs project in parsed entries.
    // For now we pass combined; caller can control what entries they feed.
  }

  if (filtered.length === 0) {
    return "";
  }

  const groups = groupByPushback(filtered);

  let out = "";

  const scope = project ? `for ${project}` : "from your journal";
  out += `These are recorded decisions and principles ${scope}. `;
  out += `Higher pushback entries represent stronger prior commitments.\n\n`;

  const renderGroup = (title: string, items: JournalEntry[]) => {
    if (items.length === 0) return "";
    let g = `## ${title}\n\n`;
    for (const e of items) {
      const tags = (e.tags || []).length ? `tags: ${(e.tags || []).join(", ")}` : "";
      const pb = e.pushback ?? 0;
      g += `- **${e.title}** (pushback: ${pb}${tags ? `, ${tags}` : ""})\n`;
      const body = showFull ? (e.rationale || "").trim() : truncate(e.rationale || "");
      if (body) {
        g += `  ${body}\n`;
      }
      g += "\n";
    }
    return g;
  };

  out += renderGroup("Strong (pushback 7–10)", groups.strong);
  out += renderGroup("Friction (pushback 4–6)", groups.friction);
  out += renderGroup("Nudges (pushback 1–3)", groups.nudge);

  out += "If these feel out of date, run: `dora journal update` or `dora journal list`.\n";

  return out.trimEnd() + "\n";
}

const JOURNAL_BLOCK_START = "<!-- doraval-journal:start -->";
const JOURNAL_BLOCK_END = "<!-- doraval-journal:end -->";

async function appendOrUpdateJournalBlock(
  target: string,
  contextText: string,
  project: string | null,
  useReference: boolean
) {
  const absTarget = resolvePath(process.cwd(), target);

  let original = "";
  if (existsSync(absTarget)) {
    original = await Bun.file(absTarget).text();
  }

  let blockContent: string;

  if (useReference) {
    const refLines: string[] = [];
    refLines.push("## Recorded decisions (from journal)");
    refLines.push("");
    refLines.push("@~/.doraval/journals/global.md");
    if (project) {
      refLines.push(`@~/.doraval/journals/${project}.md`);
    }
    refLines.push("");
    refLines.push("_These are your synced project decisions. High pushback items are strong commitments._");
    blockContent = refLines.join("\n");
  } else {
    blockContent = contextText.trim();
  }

  const newBlock = [
    JOURNAL_BLOCK_START,
    "",
    blockContent,
    "",
    JOURNAL_BLOCK_END,
  ].join("\n");

  let updated: string;

  const startIdx = original.indexOf(JOURNAL_BLOCK_START);
  const endIdx = original.indexOf(JOURNAL_BLOCK_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // Replace existing managed block
    const before = original.slice(0, startIdx);
    const after = original.slice(endIdx + JOURNAL_BLOCK_END.length);
    updated = before + newBlock + after;
  } else {
    // Append at end (with a small separator if file has content)
    const separator = original.trim().length > 0 ? "\n\n" : "";
    updated = original + separator + newBlock + "\n";
  }

  await Bun.write(absTarget, updated);

  const action = existsSync(absTarget) && startIdx !== -1 ? "Updated" : "Added";
  ui.write(
    `\n  ${pc.green("✓")} ${action} journal decisions section in ${pc.white(target)}`
  );
  if (useReference) {
    ui.write(`  ${pc.dim("Using @import references (full files will be loaded by Claude).")}`);
  } else {
    ui.write(`  ${pc.dim("Embedded compact decisions (low noise).")}`);
  }
}

export default defineCommand({
  meta: {
    name: "context",
    description: "Output compact journal decisions (for hooks, CLAUDE.md, or piping)",
  },
  args: {
    project: {
      type: "string",
      alias: "p",
      description: "Project name (defaults to directory-based mapping)",
    },
    "min-pushback": {
      type: "string",
      description: "Only include entries with at least this pushback (1-10)",
      default: "1",
    },
    full: {
      type: "boolean",
      description: "Show full rationale instead of truncated",
      default: false,
    },
    "no-global": {
      type: "boolean",
      description: "Exclude global entries (project only)",
      default: false,
    },
    "append-to": {
      type: "string",
      description: "Append (or update) a managed section in this file (e.g. CLAUDE.md or AGENTS.md)",
    },
    reference: {
      type: "boolean",
      description: "When appending, use @import references instead of embedding compact decisions",
      default: false,
    },
    "print-hook": {
      type: "boolean",
      description: "Print a ready-to-paste SessionStart hook snippet for hooks.json",
      default: false,
    },
    json: {
      type: "boolean",
      description: "Emit Claude SessionStart hook JSON (hookSpecificOutput.additionalContext)",
      default: false,
    },
    quiet: {
      type: "boolean",
      description: "For hook use: omit plain-text output when there are no entries (still emits JSON with --json)",
      default: false,
    },
  },

  async run({ args }) {
    if (args["print-hook"]) {
      console.log(
        JSON.stringify(
          {
            hooks: [
              {
                type: "command",
                command: "sh -c 'dora journal context 2>/dev/null || true'",
              },
            ],
          },
          null,
          2
        )
      );
      ui.write("\nTip: Use `dora journal hook enable` to install the hook automatically.");
      ui.write("     Use `dora journal hook disable` to remove it.");
      ui.write("     (sh -c wrapper ensures shell features like redir work reliably.)");
      process.exit(0);
    }

    const config = await readConfig();

    let project = args.project as string | undefined;
    if (!project) {
      project = resolveProjectName(config) ?? undefined;
    }

    if (project) {
      project = sanitizeProjectName(project);
    }

    const journalsDir = getJournalsDir();

    const entries: JournalEntry[] = [];

    // Global first (cross-project principles)
    const globalPath = join(journalsDir, "global.md");
    if (existsSync(globalPath)) {
      try {
        const raw = await Bun.file(globalPath).text();
        entries.push(...parseJournalEntries(raw));
      } catch {
        // best effort
      }
    }

    // Project-specific
    if (project) {
      const projectPath = join(journalsDir, `${project}.md`);
      if (existsSync(projectPath)) {
        try {
          const raw = await Bun.file(projectPath).text();
          entries.push(...parseJournalEntries(raw));
        } catch {
          // best effort
        }
      }
    }

    const minPb = parseInt(String(args["min-pushback"] ?? "1"), 10) || 1;
    const contextText = generateJournalContext(entries, project ?? null, {
      minPushback: minPb,
      full: !!args.full,
      noGlobal: !!args["no-global"],
    });

    const appendTarget = args["append-to"] as string | undefined;

    if (appendTarget && contextText) {
      await appendOrUpdateJournalBlock(
        appendTarget,
        contextText,
        project ?? null,
        !!args.reference
      );
    }

    const useJson = !!args.json;
    const useQuiet = !!args.quiet;

    if (useJson) {
      console.log(formatJournalHookJson(contextText));
    } else if (contextText && !appendTarget) {
      console.log(contextText);
    } else if (contextText && appendTarget) {
      // When appending, stdout is optional; success message above is the main feedback.
    } else if (!useQuiet && !appendTarget && !contextText) {
      // No entries — stay silent for hooks and piping unless caller asked for noise.
    }

    // Always succeed for hook / automation safety.
    process.exit(0);
  },
});
