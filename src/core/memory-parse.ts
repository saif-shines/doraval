import { YAML } from "bun";

// ── Types ──────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;           // ulid
  title: string;        // ≤ 80 chars
  weight: number;       // 1–10
  tags: string[];
  date: string;         // ISO date
  status: "active" | "superseded" | "retired";
  body: string;         // rationale / detail
}

export interface MemoryParseResult {
  entries: MemoryEntry[];
  errors: MemoryParseError[];
}

export interface MemoryParseError {
  title?: string;
  reason: string;
  line?: number;
}

const VALID_STATUSES = ["active", "superseded", "retired"] as const;

// ── Parser ─────────────────────────────────────────────────────────

export function parseMemoryEntries(raw: string): MemoryParseResult {
  const entries: MemoryEntry[] = [];
  const errors: MemoryParseError[] = [];

  if (!raw || !raw.trim()) {
    return { entries, errors };
  }

  // Split on ## headings at the start of a line
  const sectionRegex = /^##\s+(.+)$/gm;
  const matches = Array.from(raw.matchAll(sectionRegex));

  if (matches.length === 0) {
    return { entries, errors };
  }

  const lines = raw.split("\n");

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!;
    const title = match[1]!.trim();
    const start = match.index! + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : raw.length;
    const sectionBody = raw.slice(start, end).trim();

    // Compute approximate line number for the heading
    const headingLine = raw.slice(0, match.index!).split("\n").length;

    // ── Title validation ───────────────────────────────────────
    if (title.length > 80) {
      errors.push({
        title,
        reason: `Title exceeds 80 characters (${title.length})`,
        line: headingLine,
      });
      continue;
    }

    // ── Find YAML code fence ───────────────────────────────────
    const yamlFenceMatch = sectionBody.match(/```(?:ya?ml)?\s*\n([\s\S]*?)\n```/);
    if (!yamlFenceMatch) {
      errors.push({
        title,
        reason: "No YAML metadata block found",
        line: headingLine,
      });
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
      errors.push({
        title,
        reason: `Invalid YAML: ${(err as Error).message}`,
        line: headingLine,
      });
      continue;
    }

    // ── Required field: id ─────────────────────────────────────
    if (!meta.id || typeof meta.id !== "string") {
      errors.push({
        title,
        reason: "Missing required field: id",
        line: headingLine,
      });
      continue;
    }

    // ── Required field: weight ─────────────────────────────────
    if (meta.weight === undefined || meta.weight === null) {
      errors.push({
        title,
        reason: "Missing required field: weight",
        line: headingLine,
      });
      continue;
    }
    const weight = Number(meta.weight);
    if (!Number.isInteger(weight) || weight < 1 || weight > 10) {
      errors.push({
        title,
        reason: `weight must be an integer between 1 and 10 (got ${meta.weight})`,
        line: headingLine,
      });
      continue;
    }

    // ── Required field: date ───────────────────────────────────
    if (!meta.date || typeof meta.date !== "string") {
      errors.push({
        title,
        reason: "Missing required field: date",
        line: headingLine,
      });
      continue;
    }

    // ── Status validation ──────────────────────────────────────
    const rawStatus = meta.status ?? "active";
    if (
      typeof rawStatus !== "string" ||
      !VALID_STATUSES.includes(rawStatus as (typeof VALID_STATUSES)[number])
    ) {
      errors.push({
        title,
        reason: `Invalid status: "${rawStatus}" (must be one of: ${VALID_STATUSES.join(", ")})`,
        line: headingLine,
      });
      continue;
    }
    const status = rawStatus as MemoryEntry["status"];

    // ── Optional: tags ─────────────────────────────────────────
    const tags: string[] = Array.isArray(meta.tags)
      ? (meta.tags as string[])
      : [];

    // ── Body: everything after the closing ``` ─────────────────
    const yamlBlockEnd =
      sectionBody.indexOf(yamlFenceMatch[0]!) + yamlFenceMatch[0]!.length;
    const body = sectionBody.slice(yamlBlockEnd).trim();

    entries.push({
      id: meta.id as string,
      title,
      weight,
      tags,
      date: meta.date as string,
      status,
      body,
    });
  }

  return { entries, errors };
}

// ── ULID generator (no deps) ───────────────────────────────────────

const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateUlid(): string {
  const ts = Date.now();
  let id = "";

  // 10 chars for timestamp (48-bit ms since epoch)
  let t = ts;
  for (let i = 9; i >= 0; i--) {
    id = CROCKFORD_BASE32[t % 32]! + id;
    t = Math.floor(t / 32);
  }

  // 16 chars random
  for (let i = 0; i < 16; i++) {
    id += CROCKFORD_BASE32[Math.floor(Math.random() * 32)]!;
  }

  return id;
}

// ── Serializer ─────────────────────────────────────────────────────

export function serializeEntry(entry: MemoryEntry): string {
  // Build block-style YAML manually for readable markdown output
  const tagsStr =
    entry.tags.length > 0
      ? `[${entry.tags.join(", ")}]`
      : "[]";

  const yamlLines = [
    `id: ${entry.id}`,
    `weight: ${entry.weight}`,
    `tags: ${tagsStr}`,
    `date: ${entry.date}`,
    `status: ${entry.status}`,
  ];

  const parts = [
    `## ${entry.title}`,
    "",
    "```yaml",
    ...yamlLines,
    "```",
  ];

  if (entry.body) {
    parts.push("", entry.body);
  }

  return parts.join("\n");
}
