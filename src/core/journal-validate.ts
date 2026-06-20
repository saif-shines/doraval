import type { JournalEntry } from "./journal-parse.js";

export const CANONICAL_TAGS = [
  "naming",
  "cli",
  "architecture",
  "testing",
  "ux",
  "api",
  "docs",
  "notes",
] as const;

export const VALID_STATUSES = ["active", "superseded", "retired"] as const;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEntry(entry: Partial<JournalEntry>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Relaxed fields for low-friction quick add (pushback/tags may be supplied later or via agent on-the-fly).
  // We only hard-error on obviously bad *values* when they are present.
  if (entry.pushback === undefined || entry.pushback === null) {
    warnings.push("pushback not supplied (will use default 5 when staging via journal add)");
  } else {
    const pb = Number(entry.pushback);
    if (!Number.isInteger(pb) || pb < 1 || pb > 10) {
      errors.push("pushback must be an integer between 1 and 10");
    }
  }

  if (!entry.tags || !Array.isArray(entry.tags) || entry.tags.length === 0) {
    warnings.push("tags not supplied or empty (will use [] when staging via journal add; consider canonical tags)");
  } else {
    const invalidTags = entry.tags.filter(
      (s) => !CANONICAL_TAGS.includes(s as (typeof CANONICAL_TAGS)[number])
    );
    if (invalidTags.length > 0) {
      warnings.push(
        `tags contains non-canonical values: ${invalidTags.join(", ")} (valid: ${CANONICAL_TAGS.join(", ")})`
      );
    }
  }

  if (!entry.author || typeof entry.author !== "string") {
    errors.push("author is required");
  } else if (!entry.author.startsWith("human") && !entry.author.startsWith("agent:")) {
    warnings.push(`author "${entry.author}" does not follow the recommended pattern (human or agent:<name>)`);
  }

  if (!entry.date || typeof entry.date !== "string") {
    errors.push("date is required");
  }

  if (!entry.status || !VALID_STATUSES.includes(entry.status as (typeof VALID_STATUSES)[number])) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  if (!entry.title || typeof entry.title !== "string" || entry.title.trim() === "") {
    errors.push("title is required");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
