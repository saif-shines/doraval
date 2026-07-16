import { existsSync } from "fs";
import { resolve } from "path";
import type { Validator, ValidateResult, ValidateOptions, CheckItem } from "../types.js";

const MARKDOWN_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

export const claudeMemoryValidator: Validator = {
  id: "claude:memory",
  provider: "claude",
  name: "Claude CLAUDE.md",
  description:
    "Validates CLAUDE.md: non-empty, size budget, @imports, dead links, duplicate lines",

  detect(dir: string): boolean {
    return existsSync(resolve(dir, "CLAUDE.md"));
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const errors: CheckItem[] = [];
    const warnings: CheckItem[] = [];
    const passes: CheckItem[] = [];

    const filePath = resolve(dir, "CLAUDE.md");
    const raw = await Bun.file(filePath).text();

    if (!raw.trim()) {
      errors.push({ text: "CLAUDE.md is empty" });
      return { errors, warnings, passes };
    }
    passes.push({ text: "CLAUDE.md is non-empty" });

    const lines = raw.split("\n");
    if (lines.length > 200) {
      warnings.push({
        text: `CLAUDE.md is ${lines.length} lines — official recommendation is under 200. Move reference content to skills.`,
      });
    } else {
      passes.push({
        text: `CLAUDE.md is ${lines.length} lines (under 200 recommended limit)`,
      });
    }

    // Check @path imports (line-level directives: lines where @path is the entire content)
    const importRegex = /^@([^\s]+)\s*$/gm;
    let match;
    while ((match = importRegex.exec(raw)) !== null) {
      const importPath = match[1]!;
      const resolvedImport = resolve(dir, importPath);
      if (existsSync(resolvedImport)) {
        passes.push({ text: `@import "${importPath}" exists` });
      } else {
        warnings.push({
          text: `@import "${importPath}" — file not found at ${resolvedImport}`,
        });
      }
    }

    // Dead relative markdown links (http(s)/# anchors skipped)
    let linkMatch: RegExpExecArray | null;
    MARKDOWN_LINK_RE.lastIndex = 0;
    while ((linkMatch = MARKDOWN_LINK_RE.exec(raw)) !== null) {
      const target = linkMatch[2]!.trim();
      if (target.startsWith("http://") || target.startsWith("https://") || target.startsWith("#")) {
        continue;
      }
      const resolved = resolve(dir, target);
      if (!existsSync(resolved)) {
        warnings.push({
          text: `Dead link reference: ${target} (resolved to ${resolved})`,
        });
      }
    }

    // Duplicate non-blank, non-heading lines (same normal form)
    const seen = new Map<string, number>();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const normalized = trimmed.toLowerCase().replace(/\s+/g, " ");
      seen.set(normalized, (seen.get(normalized) ?? 0) + 1);
    }
    for (const [normalized, count] of seen) {
      if (count > 1) {
        warnings.push({
          text: `Duplicate instruction appears ${count} times: "${normalized}"`,
        });
      }
    }

    return { errors, warnings, passes };
  },
};
