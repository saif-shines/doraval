import { defineCommand } from "citty";
import { existsSync } from "fs";
import { resolve } from "path";
import pc from "picocolors";
import { parseFrontmatter } from "../../core/frontmatter.js";

export default defineCommand({
  meta: {
    name: "score",
    description: "Score quality and get actionable suggestions",
  },
  args: {
    path: {
      type: "positional",
      description: "Path to skill directory or plugin root",
      required: true,
    },
    agent: {
      type: "string",
      alias: "a",
      description: "Force a specific agent adapter",
    },
    format: {
      type: "string",
      alias: "f",
      description: "Output format (json or table)",
      default: "table",
    },
    verbose: {
      type: "boolean",
      alias: "v",
      description: "Show detailed diagnostics",
      default: false,
    },
    ci: {
      type: "boolean",
      description: "Machine-friendly output, non-zero exit on issues",
      default: false,
    },
  },

  async run({ args }) {
    const targetPath = args.path;
    const fullPath = resolve(targetPath);
    const skillMd = resolve(fullPath, "SKILL.md");

    if (!existsSync(skillMd)) {
      console.error(
        `${pc.red("✗")} No SKILL.md found at ${targetPath}`
      );
      process.exit(1);
    }

    const raw = await Bun.file(skillMd).text();
    let parsed;
    try {
      parsed = parseFrontmatter(raw);
    } catch {
      console.error(
        `${pc.red("✗")} Failed to parse YAML frontmatter in SKILL.md`
      );
      process.exit(1);
    }

    const checks: { pass: boolean; label: string }[] = [];
    const suggestions: string[] = [];

    // Check: description has trigger phrases
    const desc = String(parsed.data.description || "");
    const hasTriggers =
      desc.includes("use when") ||
      desc.includes("Use when") ||
      desc.includes("trigger") ||
      desc.includes("invoke");
    checks.push({
      pass: hasTriggers,
      label: "Description includes trigger phrases",
    });
    if (!hasTriggers) {
      suggestions.push(
        'Add trigger phrases to description (e.g. "Use when the user asks to...")'
      );
    }

    // Check: has steps/checklist
    const body = parsed.content;
    const hasSteps =
      /^\s*\d+\.\s/m.test(body) || /^\s*[-*]\s/m.test(body);
    checks.push({
      pass: hasSteps,
      label: "Has step-by-step instructions",
    });
    if (!hasSteps) {
      suggestions.push(
        "Add numbered steps or a checklist to guide the agent"
      );
    }

    // Check: uses imperative voice
    const hasImperative =
      /\b(Create|Add|Run|Install|Configure|Set|Build|Use|Check|Verify|Ensure)\b/.test(
        body
      );
    checks.push({
      pass: hasImperative,
      label: 'Uses imperative voice ("Do X" not "You might X")',
    });

    // Check: has code examples
    const hasCode = body.includes("```");
    checks.push({ pass: hasCode, label: "Has code examples" });
    if (!hasCode) {
      suggestions.push("Add code examples if the skill involves code");
    }

    // Check: has constraints
    const hasConstraints =
      /\bMUST\b/.test(body) || /\bMUST NOT\b/.test(body);
    checks.push({
      pass: hasConstraints,
      label: "Has MUST/MUST NOT constraints",
    });
    if (!hasConstraints) {
      suggestions.push(
        "Add explicit constraints (MUST / MUST NOT) as guardrails"
      );
    }

    // Check: no ambiguous language
    const ambiguous = body.match(
      /\b(maybe|possibly|consider|you might want to|perhaps)\b/gi
    );
    const noAmbiguity = !ambiguous || ambiguous.length === 0;
    checks.push({
      pass: noAmbiguity,
      label: "No ambiguous language",
    });
    if (!noAmbiguity) {
      suggestions.push(
        `Remove ambiguous phrasing: ${ambiguous!.slice(0, 3).join(", ")}`
      );
    }

    const passed = checks.filter((c) => c.pass).length;
    const total = checks.length;

    if (args.format === "json") {
      console.log(
        JSON.stringify(
          { path: targetPath, passed, total, checks, suggestions },
          null,
          2
        )
      );
    } else {
      console.error(
        `\n  ${pc.bold("doraval")} v0.0.1 — Scoring skill\n`
      );

      for (const c of checks) {
        const icon = c.pass ? pc.green("✓") : pc.yellow("⚠");
        console.log(`  ${icon} ${c.label}`);
      }

      if (suggestions.length > 0) {
        console.log(`\n  ${pc.bold("Suggestions:")}`);
        suggestions.forEach((s, i) => {
          console.log(`    ${i + 1}. ${s}`);
        });
      }

      console.log(
        `\n  Score: ${passed}/${total} checks passed, ${suggestions.length} suggestion(s)\n`
      );
    }
  },
});
