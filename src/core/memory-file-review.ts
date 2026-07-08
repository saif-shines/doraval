import { readFileSync, existsSync } from "fs";
import { dirname, resolve, basename } from "path";
import { classifySkillDir } from "./skill-classify.js";
import type { ReviewFinding, ReviewOptions, ReviewResult } from "./review.js";
import { runJudge, type LintResult } from "./skill-lint.js";
import { detectCapabilities, type Capabilities } from "./capability-detect.js";
import { readConfig, getEvalConfig, type EvalConfig } from "./journal-config.js";
import { loadPrinciples, buildPrincipleRubric } from "./memory-rubric.js";
import { PrerequisiteError, NetworkError } from "./errors.js";
import type { AgentConfig } from "./agent-invoke.js";

export const MEMORY_FILE_NAMES = new Set([
  "CLAUDE.md",
  "AGENTS.md",
  ".cursorrules",
  "copilot-instructions.md",
]);

const SIZE_BUDGET_LINES = 200;
const IMPORT_LINE_RE = /^@([^\s]+)\s*$/gm;
const MARKDOWN_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
const CLAUDE_ONLY_MARKERS: { pattern: RegExp; label: string }[] = [
  { pattern: /\$ARGUMENTS/, label: "$ARGUMENTS" },
  { pattern: /\$\{CLAUDE_/, label: "${CLAUDE_*}" },
  { pattern: /^@[^\s]+\s*$/m, label: "@import" },
];

function pad(n: number): string {
  return String(n).padStart(3, "0");
}

export function buildMemoryLintPrompt(content: string, fileLabel: string, extraRubric?: string): string {
  const rubricSection = extraRubric?.trim()
    ? `\nPROJECT PRINCIPLES (recorded by this team via dora memory — flag any instruction that violates one, citing the principle):\n${extraRubric}\n`
    : "";

  return `You are reviewing ${fileLabel}, an always-loaded memory/instruction file for AI coding agents.
${rubricSection}
CONTENT:
${content}

Evaluate across exactly two dimensions:
1. CONTRADICTION: Do any instructions conflict with each other?
2. CLARITY (vagueness): Are instructions specific and unambiguous, or vague enough that two engineers/agents would interpret them differently?

Rules:
- "error" = the file will likely cause an agent to do the wrong thing
- "warning" = the file may be interpreted inconsistently across sessions/agents
- "info" = improvement opportunity
- If no issues found in a category, omit it from findings (do not invent problems)
- Only use category "contradiction" or "clarity" — no other categories apply here
- overall = "fail" if any errors, "warn" if any warnings, "pass" otherwise

CRITICAL: Return ONLY a JSON object. No markdown, no prose. First char '{', last char '}'.

{
  "overall": "pass" | "warn" | "fail",
  "summary": "<one sentence>",
  "findings": [
    {
      "severity": "error" | "warning" | "info",
      "category": "contradiction" | "clarity",
      "finding": "<what the issue is>",
      "suggestion": "<concrete fix>"
    }
  ]
}`;
}

function buildHeuristicsFindings(content: string, path: string, dir: string): ReviewFinding[] {
  let hIdx = 1;
  const findings: ReviewFinding[] = [];

  // Dead markdown-link references
  let linkMatch: RegExpExecArray | null;
  MARKDOWN_LINK_RE.lastIndex = 0;
  while ((linkMatch = MARKDOWN_LINK_RE.exec(content)) !== null) {
    const target = linkMatch[2]!.trim();
    if (target.startsWith("http://") || target.startsWith("https://") || target.startsWith("#")) continue;
    const resolved = resolve(dir, target);
    if (!existsSync(resolved)) {
      findings.push({
        id: `heur-${pad(hIdx++)}`, tier: "heuristics", severity: "warning",
        message: `Dead link reference: ${target} (resolved to ${resolved})`, fixable: false,
      });
    }
  }

  // Exact-after-normalize duplicate lines (skip blank lines and headings)
  const seen = new Map<string, number>();
  for (const line of content.split("\n")) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;
    const normalized = trimmedLine.toLowerCase().replace(/\s+/g, " ");
    seen.set(normalized, (seen.get(normalized) ?? 0) + 1);
  }
  for (const [normalized, count] of seen) {
    if (count > 1) {
      findings.push({
        id: `heur-${pad(hIdx++)}`, tier: "heuristics", severity: "warning",
        message: `Duplicate instruction appears ${count} times: "${normalized}"`, fixable: false,
      });
    }
  }

  // Claude-only syntax leaking into the shared AGENTS.md
  if (basename(path) === "AGENTS.md") {
    for (const marker of CLAUDE_ONLY_MARKERS) {
      if (marker.pattern.test(content)) {
        findings.push({
          id: `heur-${pad(hIdx++)}`, tier: "heuristics", severity: "warning",
          message: `Claude-only syntax (${marker.label}) found in AGENTS.md — Cursor, Codex, and Copilot won't process this`,
          fixable: false,
        });
      }
    }
  }

  if (findings.length === 0) {
    findings.push({
      id: `heur-${pad(hIdx++)}`, tier: "heuristics", severity: "pass",
      message: "no dead links, duplicate lines, or agent-specific syntax found", fixable: false,
    });
  }

  return findings;
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

  const heurFindings = buildHeuristicsFindings(content, path, dir);
  const heurTier = {
    passed: heurFindings.filter(f => f.severity === "pass").length,
    warnings: heurFindings.filter(f => f.severity === "warning").length,
    errors: heurFindings.filter(f => f.severity === "error").length,
    findings: heurFindings,
  };

  const tiers: ReviewResult["tiers"] = { structure: structTier, heuristics: heurTier };

  if (!opts.quick) {
    const cfg = await readConfig();
    const evalCfg: Partial<EvalConfig> = getEvalConfig(cfg);
    const agentCfg: AgentConfig = cfg?.agent ?? { command: "" };
    const caps: Capabilities = detectCapabilities(evalCfg);

    if (caps.preferred === "none") {
      if (opts.deep) {
        throw new PrerequisiteError({
          code: "E-PRE-002",
          message: "Deep review requires an LLM judge",
        });
      }
      tiers.llm = { available: false, findings: [] };
    } else {
      const principles = loadPrinciples(opts.cwd ?? process.cwd());
      const rubricText = buildPrincipleRubric(principles) || undefined;
      const prompt = buildMemoryLintPrompt(content, basename(path), rubricText);
      const judge = opts.memoryLintFn ?? runJudge;
      const result: LintResult = await judge(prompt, caps, agentCfg, evalCfg);

      if (result.ok) {
        let lIdx = 1;
        tiers.llm = {
          available: true,
          method: result.method,
          findings: result.output.findings.map((f) => ({
            id: `llm-${pad(lIdx++)}`,
            tier: "llm" as const,
            severity: f.severity,
            message: f.finding,
            fixable: false,
          })),
        };
      } else {
        if (opts.deep) {
          throw new NetworkError({
            code: "E-NET-002",
            message: `LLM judge failed: ${result.error}`,
            suggestion: "Re-run, check the judge CLI/API credentials, or drop --deep to review without the LLM tier",
          });
        }
        tiers.llm = { available: false, findings: [] };
      }
    }
  }

  tiers.sessions = { available: false, findings: [] };

  const all = [...structTier.findings, ...heurTier.findings, ...(tiers.llm?.findings ?? [])];

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
