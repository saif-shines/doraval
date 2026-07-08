import { readFileSync, existsSync } from "fs";
import { dirname, resolve, basename } from "path";
import { classifySkillDir } from "./skill-classify.js";
import type { ReviewFinding, ReviewOptions, ReviewResult } from "./review.js";

export const MEMORY_FILE_NAMES = new Set([
  "CLAUDE.md",
  "AGENTS.md",
  ".cursorrules",
  "copilot-instructions.md",
]);

const SIZE_BUDGET_LINES = 200;
const IMPORT_LINE_RE = /^@([^\s]+)\s*$/gm;

function pad(n: number): string {
  return String(n).padStart(3, "0");
}

export async function reviewMemoryFile(path: string, opts: ReviewOptions = {}): Promise<ReviewResult> {
  const origin = classifySkillDir(path, { cwd: opts.cwd ?? process.cwd() });
  const content = readFileSync(path, "utf-8");
  const lines = content.split("\n");
  const dir = dirname(path);

  let sIdx = 1;
  const structFindings: ReviewFinding[] = [];

  const trimmed = content.trim();
  if (trimmed.length === 0) {
    structFindings.push({
      id: `struct-${pad(sIdx++)}`, tier: "structure", severity: "error",
      message: `${basename(path)} is empty`, fixable: false,
    });
  } else {
    structFindings.push({
      id: `struct-${pad(sIdx++)}`, tier: "structure", severity: "pass",
      message: `${basename(path)} is non-empty`, fixable: false,
    });
  }

  if (lines.length > SIZE_BUDGET_LINES) {
    structFindings.push({
      id: `struct-${pad(sIdx++)}`, tier: "structure", severity: "warning",
      message: `${lines.length} lines exceeds the ${SIZE_BUDGET_LINES}-line guidance budget for always-loaded context`,
      fixable: false,
    });
  } else if (trimmed.length > 0) {
    structFindings.push({
      id: `struct-${pad(sIdx++)}`, tier: "structure", severity: "pass",
      message: `within the ${SIZE_BUDGET_LINES}-line size budget (${lines.length} lines)`, fixable: false,
    });
  }

  let importMatch: RegExpExecArray | null;
  let importCount = 0;
  let brokenImports = 0;
  IMPORT_LINE_RE.lastIndex = 0;
  while ((importMatch = IMPORT_LINE_RE.exec(content)) !== null) {
    importCount++;
    const importPath = resolve(dir, importMatch[1]!);
    if (!existsSync(importPath)) {
      brokenImports++;
      structFindings.push({
        id: `struct-${pad(sIdx++)}`, tier: "structure", severity: "error",
        message: `@import not found: ${importMatch[1]} (resolved to ${importPath})`, fixable: false,
      });
    }
  }
  if (importCount > 0 && brokenImports === 0) {
    structFindings.push({
      id: `struct-${pad(sIdx++)}`, tier: "structure", severity: "pass",
      message: `${importCount} @import(s) resolved`, fixable: false,
    });
  }

  const structTier = {
    passed: structFindings.filter(f => f.severity === "pass").length,
    warnings: structFindings.filter(f => f.severity === "warning").length,
    errors: structFindings.filter(f => f.severity === "error").length,
    findings: structFindings,
  };

  const heurTier = { passed: 0, warnings: 0, errors: 0, findings: [] as ReviewFinding[] };

  const tiers: ReviewResult["tiers"] = {
    structure: structTier,
    heuristics: heurTier,
    sessions: { available: false, findings: [] },
  };

  const all = [...structTier.findings, ...heurTier.findings];

  return {
    path,
    origin,
    tiers,
    summary: {
      passed: all.filter(f => f.severity === "pass").length,
      warnings: all.filter(f => f.severity === "warning").length,
      errors: all.filter(f => f.severity === "error").length,
    },
  };
}
