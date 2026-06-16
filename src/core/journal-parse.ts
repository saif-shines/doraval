import { YAML } from "bun";

export interface JournalEntry {
  title: string;
  pushback: number;
  tags: string[];   // renamed from "scope" for broader use (decisions + general notes)
  author: string;
  date: string;
  status: "active" | "superseded" | "retired";
  superseded_by?: string;
  rationale: string;
}

export interface ParseResult {
  entries: JournalEntry[];
  warnings: string[];
}

/**
 * Parses a journal markdown file into structured entries.
 * 
 * Expected format per entry:
 * 
 * ## Title of the decision
 * 
 * ```yaml
 * pushback: 7
 * tags: [naming, cli]
 * author: human
 * date: 2026-05-25
 * status: active
 * ```
 * 
 * Free form rationale text here.
 * Can be multiple paragraphs. (Tags are used for both decisions with pushback and general useful notes.)
 */
export function parseJournalEntries(raw: string): JournalEntry[] {
  const { entries } = parseJournalEntriesWithWarnings(raw);
  return entries;
}

export function parseJournalEntriesWithWarnings(raw: string): ParseResult {
  const entries: JournalEntry[] = [];
  const warnings: string[] = [];

  if (!raw || !raw.trim()) {
    return { entries, warnings };
  }

  // Split on headings that start with "## " at the beginning of a line.
  // This handles the common case where the file may start with a top-level # title.
  const sectionRegex = /^##\s+(.+)$/gm;
  const matches = Array.from(raw.matchAll(sectionRegex));

  if (matches.length === 0) {
    return { entries, warnings };
  }

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!;
    const title = match[1]!.trim();
    const start = match.index! + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : raw.length;

    const sectionBody = raw.slice(start, end).trim();

    // Find the YAML code fence
    const yamlFenceMatch = sectionBody.match(/```(?:ya?ml)?\s*\n([\s\S]*?)\n```/);
    if (!yamlFenceMatch) {
      warnings.push(`Entry "${title}" has no YAML metadata block`);
      continue;
    }

    const yamlContent = yamlFenceMatch[1]!;
    let meta: Record<string, unknown> = {};
    try {
      const parsed = YAML.parse(yamlContent);
      if (parsed && typeof parsed === "object") {
        meta = parsed as Record<string, unknown>;
      }
    } catch (err) {
      warnings.push(`Entry "${title}" has invalid YAML: ${(err as Error).message}`);
      continue;
    }

    // Extract rationale: everything after the closing ``` of the YAML block
    const yamlBlockEnd = sectionBody.indexOf(yamlFenceMatch[0]!) + yamlFenceMatch[0]!.length;
    const rationale = sectionBody.slice(yamlBlockEnd).trim();

    const pushback = Number(meta.pushback);
    // Support both "tags" (new) and "scope" (legacy) for backward compat with existing journals
    const tags = Array.isArray(meta.tags) ? (meta.tags as string[])
               : Array.isArray(meta.scope) ? (meta.scope as string[])
               : [];
    const author = typeof meta.author === "string" ? meta.author : "human";
    const date = (typeof meta.date === "string" ? meta.date : "") ?? "";
    const status = ((meta.status as JournalEntry["status"]) || "active") ?? "active";
    const superseded_by =
      typeof meta.superseded_by === "string" ? meta.superseded_by : undefined;

    entries.push({
      title,
      pushback: isNaN(pushback) ? 0 : pushback,
      tags,
      author,
      date,
      status,
      superseded_by,
      rationale,
    });
  }

  return { entries, warnings };
}
