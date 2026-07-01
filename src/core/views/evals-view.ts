/**
 * Shared eval-history reader.
 * Consumed by: dora ui (web REST), TUI Evals pane, eval-history.ts command.
 */
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { getEvalsDir } from "../journal-config.js";
import type { EvalResult } from "../session-eval.js";

export interface EvalResultWithMeta extends EvalResult {
  _filename?: string;
}

export async function loadEvals(
  opts: { limit?: number; skill?: string } = {}
): Promise<EvalResultWithMeta[]> {
  const { limit = 30, skill } = opts;
  const dir = getEvalsDir();
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();

  const results: EvalResultWithMeta[] = [];
  for (const name of files) {
    if (results.length >= limit) break;
    try {
      const raw = await Bun.file(join(dir, name)).text();
      const parsed = JSON.parse(raw) as EvalResult;
      if (!parsed || (!parsed.verdict && !parsed.skill)) continue;
      if (parsed.schemaVersion !== 1) continue;
      if (skill && !parsed.skill.includes(skill)) continue;
      results.push({ ...parsed, _filename: name });
    } catch {}
  }

  // Newest first by timestamp field
  results.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  return results.slice(0, limit);
}
