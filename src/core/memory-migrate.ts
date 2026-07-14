import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { YAML } from "bun";
import { getDoravalDir, getJournalsDir, getPendingDir } from "./journal-config.js";
import { parseJournalEntriesWithWarnings, type JournalEntry } from "./journal-parse.js";
import {
  getGlobalPrinciplesPath,
  getProjectPrinciplesPath,
  getProjectSlug,
  ensureMemoryDirs,
} from "./memory-config.js";
import { generateUlid, serializeEntry, type MemoryEntry } from "./memory-parse.js";

export interface MigrationReport {
  migrated: number;
  droppedCorrupt: Array<{ source: string; title?: string; reason: string }>;
  deduped: number;
  noKnownDirectory: number;
  alreadyMigrated: boolean;
}

interface JournalProjectMapping {
  remote_path: string;
  local_path: string;
  source_dir?: string;
}

interface JournalConfigShape {
  journal: { repo: string; projects: Record<string, JournalProjectMapping> };
}

export function getMigrationMarkerPath(): string {
  return join(getDoravalDir(), "memory", ".journal-migrated");
}

function readLegacyConfig(): JournalConfigShape | null {
  const path = join(getDoravalDir(), "config.yml");
  if (!existsSync(path)) return null;
  try {
    return YAML.parse(readFileSync(path, "utf-8")) as JournalConfigShape;
  } catch {
    return null;
  }
}

function toMemoryEntry(j: JournalEntry, legacyTag: string | undefined): MemoryEntry {
  const rawWeight = j.pushback;
  const weight = Number.isFinite(rawWeight) && rawWeight >= 1 ? Math.min(10, Math.round(rawWeight)) : 3;

  const validDate = typeof j.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(j.date);
  const date = validDate ? j.date : new Date().toISOString().slice(0, 10);

  const status: MemoryEntry["status"] = (["active", "superseded", "retired"] as const).includes(
    j.status as any
  )
    ? j.status
    : "active";

  const title = j.title.length > 80 ? j.title.slice(0, 77) + "..." : j.title;

  // "raw-sentence titles duplicated as bodies" (storage-audit finding): drop the
  // body when it's just the title repeated back.
  const bodyIsTitleEcho = j.rationale.trim().toLowerCase() === j.title.trim().toLowerCase();
  const body = bodyIsTitleEcho ? "" : j.rationale;

  const tags = legacyTag ? [...j.tags, legacyTag] : j.tags;

  return {
    id: generateUlid(),
    title,
    weight,
    tags,
    date,
    status,
    body,
  };
}

function appendEntries(targetPath: string, entries: MemoryEntry[]): void {
  if (entries.length === 0) return;
  const dir = join(targetPath, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const existing = existsSync(targetPath) ? readFileSync(targetPath, "utf-8") : "";
  const serialized = entries.map(serializeEntry).join("\n\n");
  const prefix = existing.trim().length > 0 ? "\n\n" : "";
  writeFileSync(targetPath, existing + prefix + serialized + "\n", "utf-8");
}

function dedupeByTitle(entries: JournalEntry[]): { kept: JournalEntry[]; deduped: number } {
  const seen = new Set<string>();
  const kept: JournalEntry[] = [];
  let deduped = 0;
  for (const e of entries) {
    const key = e.title.trim().toLowerCase();
    if (seen.has(key)) {
      deduped++;
      continue;
    }
    seen.add(key);
    kept.push(e);
  }
  return { kept, deduped };
}

function collectFromFile(path: string, source: string, report: MigrationReport): JournalEntry[] {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf-8");
  const { entries, warnings } = parseJournalEntriesWithWarnings(raw);
  for (const w of warnings) {
    const titleMatch = w.match(/^Entry "(.+)" has/);
    report.droppedCorrupt.push({
      source,
      title: titleMatch?.[1],
      reason: w,
    });
  }
  return entries;
}

/**
 * One-shot conversion of every legacy journal entry (global + all registered
 * projects + never-synced pending drafts) into memory format v2. Safe to call
 * repeatedly — no-ops after the first successful run.
 */
export function migrateJournalToMemory(): MigrationReport {
  const report: MigrationReport = {
    migrated: 0,
    droppedCorrupt: [],
    deduped: 0,
    noKnownDirectory: 0,
    alreadyMigrated: false,
  };

  const markerPath = getMigrationMarkerPath();
  if (existsSync(markerPath)) {
    report.alreadyMigrated = true;
    return report;
  }

  const journalsDir = getJournalsDir();
  if (!existsSync(journalsDir)) {
    return report; // nothing to migrate; do not write a marker (nothing "done")
  }

  const config = readLegacyConfig();
  const globalEntries = collectFromFile(join(journalsDir, "global.md"), "global.md", report);
  const { kept: dedupedGlobal, deduped: globalDeduped } = dedupeByTitle(globalEntries);
  report.deduped += globalDeduped;

  const byProjectSlug = new Map<string, JournalEntry[]>();
  const orphaned: Array<{ legacyName: string; entries: JournalEntry[] }> = [];

  const projects = config?.journal.projects ?? {};
  for (const [name, mapping] of Object.entries(projects)) {
    const fileEntries = collectFromFile(mapping.local_path, `${name}.md`, report);

    const pendingDir = join(getPendingDir(), name);
    const pendingEntries: JournalEntry[] = [];
    if (existsSync(pendingDir)) {
      for (const f of readdirSync(pendingDir)) {
        if (!f.endsWith(".md") || f === ".gitkeep") continue;
        pendingEntries.push(...collectFromFile(join(pendingDir, f), `pending/${name}/${f}`, report));
      }
    }

    const { kept, deduped } = dedupeByTitle([...fileEntries, ...pendingEntries]);
    report.deduped += deduped;
    if (kept.length === 0) continue;

    if (mapping.source_dir) {
      const slug = getProjectSlug(mapping.source_dir);
      byProjectSlug.set(slug, [...(byProjectSlug.get(slug) ?? []), ...kept]);
    } else {
      report.noKnownDirectory += kept.length;
      orphaned.push({ legacyName: name, entries: kept });
    }
  }

  ensureMemoryDirs();

  const globalMemoryEntries = [
    ...dedupedGlobal.map((j) => toMemoryEntry(j, undefined)),
    ...orphaned.flatMap(({ legacyName, entries }) =>
      entries.map((j) => toMemoryEntry(j, `legacy:${legacyName}`))
    ),
  ];
  appendEntries(getGlobalPrinciplesPath(), globalMemoryEntries);
  report.migrated += globalMemoryEntries.length;

  for (const [slug, entries] of byProjectSlug) {
    const memoryEntries = entries.map((j) => toMemoryEntry(j, undefined));
    appendEntries(getProjectPrinciplesPath(slug), memoryEntries);
    report.migrated += memoryEntries.length;
  }

  writeFileSync(markerPath, new Date().toISOString(), "utf-8");
  return report;
}

/** Called at the top of every `dora memory` subcommand. No-op after first success. */
export function runJournalMigrationIfNeeded(): MigrationReport | null {
  if (existsSync(getMigrationMarkerPath())) return null;
  if (!existsSync(getJournalsDir())) return null;
  const report = migrateJournalToMemory();
  return report.alreadyMigrated ? null : report;
}
