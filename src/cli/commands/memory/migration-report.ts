import type { MigrationReport } from "../../../core/memory-migrate.js";
import { ui } from "../../out.js";

/**
 * Prints the one-time journal->memory migration notice. No-op when
 * runJournalMigrationIfNeeded() returned null (already migrated, or nothing
 * to migrate). Callers gate this behind `mode.format !== "json"` where a
 * --format json path exists — migration itself still runs either way.
 */
export function reportMigration(migration: MigrationReport | null): void {
  if (!migration) return;
  ui.blank();
  ui.info(
    `Migrated ${migration.migrated} legacy journal entr${migration.migrated === 1 ? "y" : "ies"} into memory` +
      (migration.droppedCorrupt.length > 0 ? ` (${migration.droppedCorrupt.length} dropped as corrupt — see below)` : "") +
      "."
  );
  for (const d of migration.droppedCorrupt) {
    ui.warn(`  ${d.source}${d.title ? ` "${d.title}"` : ""}: ${d.reason}`);
  }
  if (migration.noKnownDirectory > 0) {
    ui.dim(
      `  ${migration.noKnownDirectory} entr${migration.noKnownDirectory === 1 ? "y" : "ies"} had no known project directory — filed under global with a "legacy:<project>" tag.`
    );
  }
  ui.blank();
}
