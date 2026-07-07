import { readFileSync, writeFileSync } from "fs";
import { resolve, basename } from "path";
import type { ReviewFinding } from "./review.js";

export interface FixEdit {
  file: string;
  description: string;
  diff: string;
  apply(): void;
}

export interface FixResult {
  mechanical: FixEdit[];
  judgment: string[];
}

function generateDiff(before: string, after: string, file: string): string {
  const bLines = before.split("\n");
  const aLines = after.split("\n");
  const lines: string[] = [`--- a/${file}`, `+++ b/${file}`];
  for (const l of bLines) lines.push(`-${l}`);
  for (const l of aLines) lines.push(`+${l}`);
  return lines.join("\n");
}

function extractFrontmatter(raw: string): { yaml: string; body: string } | null {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  return { yaml: m[1]!, body: m[2] ?? "" };
}

function buildAddFieldFix(skillDir: string, finding: ReviewFinding): FixEdit | null {
  const file = resolve(skillDir, "SKILL.md");
  let raw: string;
  try { raw = readFileSync(file, "utf-8"); } catch { return null; }

  const parsed = extractFrontmatter(raw);
  if (!parsed) return null;

  const dirName = basename(skillDir);
  const fieldMatch = finding.message.match(/Missing "(\w+)"/i);
  const field = fieldMatch?.[1] ?? "name";
  const value = field === "name" ? dirName : "TODO";

  const oldFm = `---\n${parsed.yaml}\n---`;
  const newYaml = `${parsed.yaml}\n${field}: ${value}`;
  const newFm = `---\n${newYaml}\n---`;
  const newRaw = `${newFm}\n${parsed.body}`;
  const diff = generateDiff(oldFm, newFm, "SKILL.md");

  return {
    file,
    description: `Add ${field}: ${value}`,
    diff,
    apply() { writeFileSync(file, newRaw, "utf-8"); },
  };
}

export function collectFixes(findings: ReviewFinding[], skillDir: string): FixResult {
  const mechanical: FixEdit[] = [];
  const judgment: string[] = [];

  for (const f of findings) {
    if (f.severity === "pass" || f.severity === "info") continue;

    if (f.fixable && f.fix) {
      switch (f.fix.type) {
        case "rename_field":
          judgment.push(`[${f.id}] ${f.message} — rename requires human judgment`);
          break;
        case "add_field": {
          const edit = buildAddFieldFix(skillDir, f);
          if (edit) mechanical.push(edit);
          else judgment.push(`[${f.id}] ${f.message} — could not read SKILL.md`);
          break;
        }
        case "content":
          judgment.push(`[${f.id}] ${f.message} — content rewrite needed`);
          break;
      }
    } else if (!f.fixable) {
      judgment.push(`[${f.id}] ${f.message}`);
    }
  }

  return { mechanical, judgment };
}