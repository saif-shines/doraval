import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { getEvalsDir } from "./journal-config.js";
import type { LiveRunFinding, LiveRunVerdict } from "./scenario-run.js";

export interface BaselineEntry {
  skill: string;
  agent: string;
  when: string;
  variant: "with-skill";
  verdict: LiveRunVerdict["verdict"];
}

export interface Baseline {
  updatedAt: string;
  entries: BaselineEntry[];
}

export function baselinePath(): string {
  return join(getEvalsDir(), "baseline.json");
}

export function readBaseline(): Baseline | null {
  const file = baselinePath();
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Baseline;
    if (!parsed || !Array.isArray(parsed.entries)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeBaseline(entries: BaselineEntry[]): void {
  const file = baselinePath();
  mkdirSync(dirname(file), { recursive: true });
  const next: Baseline = { updatedAt: new Date().toISOString(), entries };
  writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
}

export function withSkillEntries(
  skill: string,
  agent: string,
  runs: LiveRunFinding[],
): BaselineEntry[] {
  return runs
    .filter((r) => r.variant === "with-skill")
    .map((r) => ({ skill, agent, when: r.when, variant: "with-skill" as const, verdict: r.verdict }));
}

export interface BaselineNote {
  when: string;
  kind: "regressed" | "new";
  detail: string;
}

/** Compare current with-skill verdicts to the last saved baseline. */
export function compareBaseline(
  previous: Baseline | null,
  current: BaselineEntry[],
): BaselineNote[] {
  if (!previous) {
    return current.map((c) => ({ when: c.when, kind: "new" as const, detail: "no baseline yet" }));
  }
  const notes: BaselineNote[] = [];
  for (const cur of current) {
    const prev = previous.entries.find(
      (e) => e.skill === cur.skill && e.agent === cur.agent && e.when === cur.when,
    );
    if (!prev) {
      notes.push({ when: cur.when, kind: "new", detail: "new scenario" });
      continue;
    }
    if (prev.verdict === "PASS" && cur.verdict === "FAIL") {
      notes.push({ when: cur.when, kind: "regressed", detail: "was PASS, now FAIL" });
    }
  }
  return notes;
}

export function shouldSaveBaseline(current: BaselineEntry[]): boolean {
  return current.length > 0 && current.every((e) => e.verdict === "PASS");
}
