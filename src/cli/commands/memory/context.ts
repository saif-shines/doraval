import { defineCommand } from "citty";
import { existsSync } from "fs";
import { resolve as resolvePath } from "path";
import { loadPrinciples, type Principle } from "../../../core/memory-rubric.js";
import { runJournalMigrationIfNeeded } from "../../../core/memory-migrate.js";
import { ui } from "../../out.js";
import { exit } from "../../render/exit.js";

function truncate(text: string, max = 180): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1) + "…";
}

export function buildMemoryContext(principles: Principle[], opts: { full?: boolean } = {}): string {
  if (principles.length === 0) return "";

  const strong = principles.filter((p) => p.weight >= 7).sort((a, b) => b.weight - a.weight);
  const friction = principles.filter((p) => p.weight >= 4 && p.weight < 7).sort((a, b) => b.weight - a.weight);
  const nudge = principles.filter((p) => p.weight < 4).sort((a, b) => b.weight - a.weight);

  let out = "These are recorded project principles from dora memory. ";
  out += "Higher weight entries represent stronger prior commitments.\n\n";

  const renderGroup = (title: string, items: Principle[]) => {
    if (items.length === 0) return "";
    let g = `## ${title}\n\n`;
    for (const p of items) {
      const tags = p.tags.length ? `tags: ${p.tags.join(", ")}` : "";
      g += `- **${p.title}** (weight: ${p.weight}${tags ? `, ${tags}` : ""})\n`;
      const body = opts.full ? p.body.trim() : truncate(p.body);
      if (body) g += `  ${body}\n`;
      g += "\n";
    }
    return g;
  };

  out += renderGroup("Strong (weight 7–10)", strong);
  out += renderGroup("Friction (weight 4–6)", friction);
  out += renderGroup("Nudges (weight 1–3)", nudge);

  out += "If these feel out of date, run: `dora memory list`.\n";
  return out.trimEnd() + "\n";
}

const CONTEXT_BLOCK_START = "<!-- doraval-memory:start -->";
const CONTEXT_BLOCK_END = "<!-- doraval-memory:end -->";

async function appendOrUpdateBlock(target: string, contextText: string) {
  const absTarget = resolvePath(process.cwd(), target);
  let original = "";
  if (existsSync(absTarget)) {
    original = await Bun.file(absTarget).text();
  }
  const newBlock = [CONTEXT_BLOCK_START, "", contextText.trim(), "", CONTEXT_BLOCK_END].join("\n");

  const startIdx = original.indexOf(CONTEXT_BLOCK_START);
  const endIdx = original.indexOf(CONTEXT_BLOCK_END);
  let updated: string;
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    updated = original.slice(0, startIdx) + newBlock + original.slice(endIdx + CONTEXT_BLOCK_END.length);
  } else {
    const separator = original.trim().length > 0 ? "\n\n" : "";
    updated = original + separator + newBlock + "\n";
  }
  await Bun.write(absTarget, updated);
  ui.success(`Updated memory principles section in ${target}`);
}

export default defineCommand({
  meta: {
    name: "context",
    description: "Output active memory principles (for hooks, CLAUDE.md, or piping)",
  },
  args: {
    full: {
      type: "boolean",
      description: "Show full principle body instead of truncated",
      default: false,
    },
    "append-to": {
      type: "string",
      description: "Append (or update) a managed section in this file (e.g. CLAUDE.md or AGENTS.md)",
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
    runJournalMigrationIfNeeded();

    const principles = loadPrinciples(process.cwd());
    const contextText = buildMemoryContext(principles, { full: !!args.full });

    const appendTarget = args["append-to"] as string | undefined;
    if (appendTarget && contextText) {
      await appendOrUpdateBlock(appendTarget, contextText);
    }

    if (args.json) {
      console.log(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext: contextText,
          },
        })
      );
    } else if (contextText && !appendTarget) {
      console.log(contextText);
    } else if (!args.quiet && !appendTarget && !contextText) {
      // stay silent for hook/piping use — matches journal context's behavior
    }

    await exit(0);
  },
});
