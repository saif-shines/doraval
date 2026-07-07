import { existsSync, readFileSync } from "fs";
import { getGlobalPrinciplesPath, getProjectPrinciplesPath, getProjectSlug } from "./memory-config.js";
import { parseMemoryEntries, type MemoryEntry } from "./memory-parse.js";

export interface Principle {
  id: string;
  title: string;
  body: string;
  weight: number;
  tags: string[];
  status: "active" | "superseded" | "retired";
  source: "global" | "project";
}

/** Load active principles (global + project scope). */
export function loadPrinciples(cwd: string): Principle[] {
  const entries: Principle[] = [];

  // Global principles
  const globalPath = getGlobalPrinciplesPath();
  if (existsSync(globalPath)) {
    const raw = readFileSync(globalPath, "utf-8");
    const { entries: parsed } = parseMemoryEntries(raw);
    for (const e of parsed) {
      if (e.status === "active") {
        entries.push({ ...e, source: "global" });
      }
    }
  }

  // Project principles
  const slug = getProjectSlug(cwd);
  const projectPath = getProjectPrinciplesPath(slug);
  if (existsSync(projectPath)) {
    const raw = readFileSync(projectPath, "utf-8");
    const { entries: parsed } = parseMemoryEntries(raw);
    for (const e of parsed) {
      if (e.status === "active") {
        entries.push({ ...e, source: "project" });
      }
    }
  }

  return entries;
}

/**
 * Build a rubric fragment from principles for injection into LLM judge prompts.
 * weight ≥ 7 → "MUST" (tier 3 violations are errors)
 * weight < 7 → "SHOULD" (tier 3 violations are warnings)
 */
export function buildPrincipleRubric(principles: Principle[]): string {
  if (principles.length === 0) return "";

  const lines = ["## Project Principles (from dora memory)", ""];
  for (const p of principles) {
    const strength = p.weight >= 7 ? "MUST" : "SHOULD";
    lines.push(`- ${strength}: ${p.title} (weight ${p.weight})`);
    if (p.body) lines.push(`  Context: ${p.body}`);
  }
  return lines.join("\n");
}

/**
 * Check skill content against principles using keyword matching (tier 2, free).
 * Returns findings for principles that appear to be violated.
 */
export function checkPrinciplesAgainstContent(
  principles: Principle[],
  content: string
): Array<{ principle: Principle; violated: boolean; detail: string }> {
  const results: Array<{ principle: Principle; violated: boolean; detail: string }> = [];

  for (const p of principles) {
    // Extract keywords from principle title (words > 3 chars, lowercased)
    const keywords = p.title
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3 && !["must", "should", "always", "never", "when", "with", "from", "that", "this", "then", "than"].includes(w));

    if (keywords.length === 0) continue;

    const lowerContent = content.toLowerCase();
    // Simple: if principle says "Prefer X" and content doesn't mention X at all → flag
    // This is intentionally conservative — false negatives are fine, false positives are not
    const titleLower = p.title.toLowerCase();
    const isNegative = titleLower.startsWith("never") || titleLower.startsWith("avoid") || titleLower.includes("must not") || titleLower.includes("do not");

    if (isNegative) {
      // "Never use default exports" → check if content DOES mention the banned thing
      const bannedWords = keywords.filter(w => !["never", "avoid"].includes(w));
      const found = bannedWords.some(w => lowerContent.includes(w));
      if (found) {
        results.push({
          principle: p,
          violated: true,
          detail: `Content may violate "${p.title}" — keyword match found`,
        });
      }
    }
    // "Prefer named exports" — can't reliably detect absence, skip for tier 2
  }

  return results;
}
