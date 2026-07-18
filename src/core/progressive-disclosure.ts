/**
 * Progressive-disclosure detector (Anthropic context-engineering notes).
 * Splits a markdown file into flat ##/### sections and flags the ones that
 * read like reference material — good candidates to move into an on-demand
 * skill instead of an always-on file. Pure text analysis; no LLM/network,
 * no file rewrite.
 */

/** Minimum section length (lines) before it's worth flagging as reference material. */
export const SECTION_LINES_WARN = 40;

export interface DisclosureCandidate {
  /** Path of the file the section was found in (as passed in). */
  file: string;
  /** Heading text as it appears, including the leading `##`/`###` markers. */
  heading: string;
  /** Number of lines the section spans (heading line through the line before the next heading). */
  lines: number;
  /** Human-readable reason this section looks like reference material. */
  reason: string;
}

interface RawSection {
  heading: string;
  startLine: number; // 0-based index into `lines`, inclusive
  endLine: number; // 0-based index into `lines`, exclusive
}

const HEADING_RE = /^(#{2,3})\s+(.*)$/;
const FENCE_RE = /^\s*```/;
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const NUMBERED_RE = /^\s*\d+\.\s?/;
const REFERENCE_HEADING_RE = /reference|recovery|procedure|example|troubleshoot|appendix|history|setup steps/i;

/** Split `content` into flat ##/### sections, ignoring headings inside fenced code blocks. */
function splitSections(content: string): RawSection[] {
  const lines = content.split("\n");
  const headings: { heading: string; line: number }[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = HEADING_RE.exec(line);
    if (m) headings.push({ heading: line.trim(), line: i });
  }
  const sections: RawSection[] = [];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i]!.line;
    const end = i + 1 < headings.length ? headings[i + 1]!.line : lines.length;
    sections.push({ heading: headings[i]!.heading, startLine: start, endLine: end });
  }
  return sections;
}

/** Sections in `content` that read like reference material worth a skill. */
export function findDisclosureCandidates(file: string, content: string): DisclosureCandidate[] {
  const lines = content.split("\n");
  const sections = splitSections(content);
  const candidates: DisclosureCandidate[] = [];

  for (const section of sections) {
    const lineCount = section.endLine - section.startLine;
    if (lineCount < SECTION_LINES_WARN) continue;

    const body = lines.slice(section.startLine, section.endLine);
    const hasCodeBlock = body.some((l) => FENCE_RE.test(l));
    const tableRows = body.filter((l) => TABLE_ROW_RE.test(l)).length;
    const hasTable = tableRows >= 2;
    const numberedLines = body.filter((l) => NUMBERED_RE.test(l)).length;
    const hasNumberedProcedure = numberedLines >= 3;
    const headingMatches = REFERENCE_HEADING_RE.test(section.heading);

    const signals: string[] = [];
    if (hasCodeBlock) signals.push("code block");
    if (hasTable) signals.push("table");
    if (hasNumberedProcedure) signals.push("numbered procedure");

    if (signals.length === 0 && !headingMatches) continue; // directive-shaped, not a candidate

    const reason =
      signals.length > 0
        ? `${lineCount}-line reference section (${signals.join(" + ")})`
        : `${lineCount}-line reference-style section (heading suggests reference material)`;

    candidates.push({ file, heading: section.heading, lines: lineCount, reason });
  }

  return candidates.sort((a, b) => b.lines - a.lines);
}
