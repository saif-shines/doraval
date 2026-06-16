import { existsSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { parseFrontmatter } from "../../core/frontmatter.js";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

export const claudeSubagentValidator: Validator = {
  id: "claude:subagent",
  provider: "claude",
  name: "Claude Subagents",
  description: "Validates agents/*.md (plugin subagents): frontmatter per spec (name, description, model, effort, maxTurns, tools, disallowedTools, skills, memory, background, isolation=worktree), body; warns on disallowed fields (hooks, mcpServers, permissionMode) for security",

  detect(dir: string): boolean {
    const agentsDir = resolve(dir, "agents");
    if (!existsSync(agentsDir)) return false;
    try {
      return readdirSync(agentsDir).some((f) => f.endsWith(".md"));
    } catch {
      return false;
    }
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const passes: string[] = [];

    const agentsDir = resolve(dir, "agents");
    const mdFiles = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));

    if (mdFiles.length === 0) {
      errors.push("agents/ directory has no .md files");
      return { errors, warnings, passes };
    }
    passes.push(`${mdFiles.length} agent definition(s) found`);

    // Allowed frontmatter per Plugins reference for *plugin* agents (more restricted than user subagents).
    const SUPPORTED = new Set([
      "name", "description", "model", "effort", "maxTurns",
      "tools", "disallowedTools", "skills", "memory", "background", "isolation",
    ]);
    // Explicitly unsupported for security (plugin agents cannot declare their own hooks/mcp/permissionMode).
    const DISALLOWED = new Set(["hooks", "mcpServers", "permissionMode"]);

    for (const file of mdFiles) {
      const filePath = join(agentsDir, file);
      const raw = await Bun.file(filePath).text();

      try {
        const parsed = parseFrontmatter(raw);
        const fm = parsed.data;

        if (Object.keys(fm).length === 0) {
          warnings.push(`${file}: no YAML frontmatter (description recommended so Claude knows when to invoke)`);
        } else {
          if (fm.description) {
            passes.push(`${file}: has frontmatter with description`);
          } else {
            warnings.push(`${file}: missing "description" in frontmatter`);
          }

          // Check supported / disallowed
          const usedSupported: string[] = [];
          Object.keys(fm).forEach((k) => {
            if (SUPPORTED.has(k)) usedSupported.push(k);
            if (DISALLOWED.has(k)) {
              errors.push(`${file}: frontmatter "${k}" is not supported for plugin-shipped agents (security restriction)`);
            }
          });
          if (usedSupported.length) {
            passes.push(`${file}: frontmatter fields: ${usedSupported.join(", ")}`);
          }

          // isolation: only "worktree" is valid value
          if (fm.isolation !== undefined && fm.isolation !== "worktree") {
            errors.push(`${file}: "isolation" must be "worktree" if present (only supported value for plugin agents)`);
          }

          // name (optional here; used for namespacing under the plugin name)
          if (fm.name && typeof fm.name === "string") {
            passes.push(`${file}: name: "${fm.name}"`);
          }
        }

        if (!parsed.content.trim()) {
          errors.push(`${file}: body is empty`);
        } else {
          passes.push(`${file}: has agent system prompt body`);
        }
      } catch {
        errors.push(`${file}: failed to parse`);
      }
    }

    return { errors, warnings, passes };
  },
};