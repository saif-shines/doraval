/**
 * B17 (thin) — settle B16 contradictions.
 * --dry-run lists; --apply / interactive take recommended resolutions.
 * No LLM layer. duplicate_intent is judgment-only (skipped).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import {
  detectContradictions,
  extractConventions,
  type Contradiction,
  type ConventionTopic,
  type ResolutionOption,
} from "./cross-agent.js";

export const RECONCILE_START = "<!-- dora-reconcile:start -->";
export const RECONCILE_END = "<!-- dora-reconcile:end -->";

export interface FileEdit {
  file: string;
  before: string;
  after: string;
  description: string;
}

export interface ReconcileItem {
  contradiction: Contradiction;
  chosen: ResolutionOption;
  /** Per-item edit previews (may be empty when skipped). */
  edits: FileEdit[];
  skipReason?: string;
}

export interface ReconcilePlan {
  cwd: string;
  contradictions: Contradiction[];
  items: ReconcileItem[];
  /** Consolidated file writes (original → final after all items). */
  fileEdits: FileEdit[];
  nothingToDo: boolean;
}

function generateDiff(before: string, after: string, file: string): string {
  const lines: string[] = [`--- a/${file}`, `+++ b/${file}`];
  if (before === after) {
    lines.push("@@ no changes @@");
    return lines.join("\n");
  }
  for (const l of before.split("\n")) lines.push(`-${l}`);
  for (const l of after.split("\n")) lines.push(`+${l}`);
  return lines.join("\n");
}

export function diffEdit(edit: FileEdit): string {
  return generateDiff(edit.before, edit.after, edit.file);
}

function readRel(cwd: string, rel: string): string {
  const abs = join(cwd, rel);
  if (!existsSync(abs)) return "";
  try {
    return readFileSync(abs, "utf-8");
  } catch {
    return "";
  }
}

function recommendedOption(cx: Contradiction): ResolutionOption {
  return cx.resolution.find((r) => r.recommended) ?? cx.resolution[0] ?? {
    action: "skip",
    label: "No resolution options",
  };
}

function parseConflictTopic(message: string): ConventionTopic | null {
  const m = message.match(/^Conflicting (\S+) convention/);
  return (m?.[1] as ConventionTopic) ?? null;
}

/** Single-value phrasing that won't re-trigger multi-value conflicts in AGENTS.md. */
function canonicalPhrase(topic: ConventionTopic, sourceText: string): string {
  const hits = extractConventions(`${sourceText}\n`, "src", "shared").filter((h) => h.topic === topic);
  const value = hits[0]?.value;
  if (!value) return sourceText.slice(0, 120);
  switch (topic) {
    case "indent":
      return value === "tabs" ? "Use tabs for indentation." : `Use ${value} indentation.`;
    case "quotes":
      return value === "single" ? "Prefer single quotes." : "Prefer double quotes.";
    case "semicolons":
      return value === "always" ? "Always use semicolons." : "Omit semicolons.";
    case "test":
      return `Run tests with \`${value}\`.`;
    case "package_manager":
      return `Use ${value} as the package manager.`;
    case "export_style":
      return value === "named" ? "Prefer named exports." : "Prefer default exports.";
    default:
      return sourceText.slice(0, 120);
  }
}

/** Drop lines that encode a given convention topic. */
export function stripTopicLines(content: string, topic: ConventionTopic): string {
  const out: string[] = [];
  for (const line of content.split("\n")) {
    const hits = extractConventions(line + "\n", "line", "shared");
    if (hits.some((h) => h.topic === topic)) continue;
    out.push(line);
  }
  // collapse excess blank lines
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

/** Drop lines matching Claude-only markers (for agent_specific_in_shared). */
export function stripClaudeOnlyLines(content: string): { cleaned: string; removed: string[] } {
  const markers = [/\$ARGUMENTS/, /\$\{CLAUDE_/, /^@[^\s]+$/];
  const removed: string[] = [];
  const cleaned = content
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (markers.some((re) => re.test(t))) {
        removed.push(line);
        return false;
      }
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
  return { cleaned, removed };
}

export function mergeReconcileSection(existing: string, bullets: string[]): string {
  const body = [
    RECONCILE_START,
    "## Shared conventions (from dora reconcile)",
    "",
    "Cross-agent rules extracted by `dora reconcile`. Prefer this over agent-local copies.",
    "",
    ...bullets.map((b) => (b.startsWith("-") ? b : `- ${b}`)),
    "",
    RECONCILE_END,
  ].join("\n");

  if (!existing.trim()) {
    return `# Agent instructions\n\n${body}\n`;
  }

  const start = existing.indexOf(RECONCILE_START);
  const end = existing.indexOf(RECONCILE_END);
  if (start !== -1 && end !== -1 && end > start) {
    // Merge bullets into existing section (dedupe by line)
    const oldSection = existing.slice(start, end + RECONCILE_END.length);
    const oldLines = new Set(
      oldSection
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("-")),
    );
    const mergedBullets = [
      ...oldLines,
      ...bullets.map((b) => (b.startsWith("-") ? b : `- ${b}`).trim()).filter((b) => !oldLines.has(b)),
    ];
    const newSection = [
      RECONCILE_START,
      "## Shared conventions (from dora reconcile)",
      "",
      "Cross-agent rules extracted by `dora reconcile`. Prefer this over agent-local copies.",
      "",
      ...mergedBullets,
      "",
      RECONCILE_END,
    ].join("\n");
    const before = existing.slice(0, start).replace(/\s*$/, "\n\n");
    const after = existing.slice(end + RECONCILE_END.length).replace(/^\s*/, "\n");
    return `${before}${newSection}${after}`;
  }

  return `${existing.replace(/\s*$/, "")}\n\n${body}\n`;
}

function ensureClaudeImport(content: string): string {
  if (!content.trim()) {
    return `# Project instructions\n\n@AGENTS.md\n`;
  }
  if (/(?:^|\n)@AGENTS\.md\s*(?:\n|$)/.test(content)) return content;
  return `${content.replace(/\s*$/, "")}\n\n@AGENTS.md\n`;
}

export type PickResolution = (cx: Contradiction) => ResolutionOption;

/**
 * Plan reconciliations. Default picker takes each recommended option.
 * Mutates a working buffer per file so multi-item plans compose.
 */
export function planReconcile(cwd: string, pick: PickResolution = recommendedOption): ReconcilePlan {
  const contradictions = detectContradictions(cwd);
  if (contradictions.length === 0) {
    return {
      cwd,
      contradictions: [],
      items: [],
      fileEdits: [],
      nothingToDo: true,
    };
  }

  const originals = new Map<string, string>();
  const working = new Map<string, string>();

  const get = (rel: string): string => {
    if (!working.has(rel)) {
      const raw = readRel(cwd, rel);
      originals.set(rel, raw);
      working.set(rel, raw);
    }
    return working.get(rel)!;
  };

  const set = (rel: string, next: string): void => {
    if (!originals.has(rel)) {
      originals.set(rel, readRel(cwd, rel));
    }
    working.set(rel, next);
  };

  const items: ReconcileItem[] = [];

  for (const cx of contradictions) {
    const chosen = pick(cx);

    if (chosen.action === "skip") {
      items.push({
        contradiction: cx,
        chosen,
        edits: [],
        skipReason: "marked intentional",
      });
      continue;
    }

    if (cx.kind === "duplicate_intent") {
      items.push({
        contradiction: cx,
        chosen: { action: "skip", label: "Judgment required — pick one skill body manually" },
        edits: [],
        skipReason: "duplicate skill bodies need a human choice (not auto-applied)",
      });
      continue;
    }

    const itemEdits: FileEdit[] = [];
    const snapshot = (file: string, before: string, after: string, description: string) => {
      if (before === after) return;
      itemEdits.push({ file, before, after, description });
    };

    if (cx.kind === "agent_specific_in_shared") {
      // Recommended: move Claude-only syntax into CLAUDE.md
      const agentsBefore = get("AGENTS.md");
      const { cleaned, removed } = stripClaudeOnlyLines(agentsBefore);
      snapshot("AGENTS.md", agentsBefore, cleaned, "Remove Claude-only syntax from AGENTS.md");
      set("AGENTS.md", cleaned);

      if (removed.length > 0) {
        const claudeBefore = get("CLAUDE.md");
        const addition = removed.join("\n");
        const claudeAfter = claudeBefore.trim()
          ? `${claudeBefore.replace(/\s*$/, "")}\n\n## Claude-only (moved from AGENTS.md)\n\n${addition}\n`
          : `# Project instructions\n\n## Claude-only (moved from AGENTS.md)\n\n${addition}\n`;
        snapshot("CLAUDE.md", claudeBefore, claudeAfter, "Move Claude-only syntax into CLAUDE.md");
        set("CLAUDE.md", claudeAfter);
      }

      items.push({ contradiction: cx, chosen, edits: itemEdits });
      continue;
    }

    // create_agents_md path (and update_file that targets AGENTS.md)
    if (chosen.action === "create_agents_md" || (chosen.action === "update_file" && chosen.file === "AGENTS.md")) {
      const topic = parseConflictTopic(cx.message);
      // Keep AGENTS.md wording free of *conflicting* alternate phrases so
      // extractConventions does not re-flag the shared file against itself.
      const bullet =
        cx.kind === "conflicting_convention" && topic
          ? `**${topic}**: ${canonicalPhrase(topic, cx.sources[0]?.text ?? "")}`
          : cx.sources[0]?.text
            ? `**shared**: ${cx.sources[0].text}`
            : cx.message;

      const agentsBefore = get("AGENTS.md");
      const agentsAfter = mergeReconcileSection(agentsBefore, [bullet]);
      snapshot("AGENTS.md", agentsBefore, agentsAfter, `Add shared convention to AGENTS.md (${cx.id})`);
      set("AGENTS.md", agentsAfter);

      // For conflicts: strip the topic lines from agent-local sources so rescan is clean
      if (cx.kind === "conflicting_convention" && topic) {
        for (const src of cx.sources) {
          if (src.file === "AGENTS.md") continue;
          const before = get(src.file);
          if (!before) continue;
          const after = stripTopicLines(before, topic);
          snapshot(src.file, before, after, `Remove conflicting ${topic} line from ${src.file}`);
          set(src.file, after);
        }
      }

      // Point Claude at shared AGENTS.md when present or just created
      if (existsSync(join(cwd, "CLAUDE.md")) || working.has("CLAUDE.md")) {
        const claudeBefore = get("CLAUDE.md");
        if (claudeBefore.trim() || existsSync(join(cwd, "CLAUDE.md"))) {
          const claudeAfter = ensureClaudeImport(claudeBefore);
          snapshot("CLAUDE.md", claudeBefore, claudeAfter, "Ensure CLAUDE.md imports @AGENTS.md");
          set("CLAUDE.md", claudeAfter);
        }
      } else if (cx.sources.some((s) => s.file === "CLAUDE.md" || s.agent === "claude")) {
        const claudeBefore = get("CLAUDE.md");
        const claudeAfter = ensureClaudeImport(claudeBefore);
        snapshot("CLAUDE.md", claudeBefore, claudeAfter, "Add CLAUDE.md with @AGENTS.md import");
        set("CLAUDE.md", claudeAfter);
      }

      items.push({ contradiction: cx, chosen, edits: itemEdits });
      continue;
    }

    if (chosen.action === "update_file" && chosen.file) {
      // Thin: only auto-apply update_file when it's a simple "match the other side"
      // for missing coverage — copy source text into the target file as a bullet.
      const target = chosen.file;
      const text = cx.sources[0]?.text;
      if (!text) {
        items.push({
          contradiction: cx,
          chosen,
          edits: [],
          skipReason: "no source text to copy",
        });
        continue;
      }
      const before = get(target);
      if (before.includes(text)) {
        items.push({ contradiction: cx, chosen, edits: [], skipReason: "already present" });
        continue;
      }
      const after = before.trim()
        ? `${before.replace(/\s*$/, "")}\n\n${text}\n`
        : `${text}\n`;
      snapshot(target, before, after, `Append convention into ${target}`);
      set(target, after);
      items.push({ contradiction: cx, chosen, edits: itemEdits });
      continue;
    }

    items.push({
      contradiction: cx,
      chosen,
      edits: [],
      skipReason: `action ${chosen.action} not auto-applicable in thin reconcile`,
    });
  }

  // Consolidate final file edits vs originals
  const fileEdits: FileEdit[] = [];
  for (const [file, after] of working) {
    const before = originals.get(file) ?? "";
    if (before === after) continue;
    fileEdits.push({
      file,
      before,
      after,
      description: `reconcile ${file}`,
    });
  }

  return {
    cwd,
    contradictions,
    items,
    fileEdits,
    nothingToDo: false,
  };
}

export function applyReconcile(plan: ReconcilePlan): string[] {
  const written: string[] = [];
  for (const edit of plan.fileEdits) {
    const abs = join(plan.cwd, edit.file);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, edit.after, "utf-8");
    written.push(edit.file);
  }
  return written;
}
