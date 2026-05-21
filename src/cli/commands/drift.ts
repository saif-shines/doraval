import { defineCommand } from "citty";
import { existsSync } from "fs";
import { resolve } from "path";
import pc from "picocolors";
import { parseFrontmatter } from "../../core/frontmatter.js";

export default defineCommand({
  meta: {
    name: "drift",
    description: "Measure how far a skill has drifted from rubric standards",
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

    const drifts: { drifted: boolean; category: string; detail: string }[] = [];

    // Trigger drift: description should have activation phrases
    const desc = String(parsed.data.description || "");
    const hasTriggers =
      desc.includes("use when") ||
      desc.includes("Use when") ||
      desc.includes("trigger") ||
      desc.includes("invoke");
    drifts.push({
      drifted: !hasTriggers,
      category: "Trigger",
      detail: hasTriggers
        ? "Description includes activation phrases"
        : 'No trigger phrases found — add "Use when..." to description',
    });

    // Structure drift: should have ordered steps or checklists
    const body = parsed.content;
    const hasSteps =
      /^\s*\d+\.\s/m.test(body) || /^\s*[-*]\s/m.test(body);
    drifts.push({
      drifted: !hasSteps,
      category: "Structure",
      detail: hasSteps
        ? "Has step-by-step instructions"
        : "No ordered steps or checklists — agent needs a clear sequence to follow",
    });

    // Voice drift: should use imperative voice
    const hasImperative =
      /\b(Create|Add|Run|Install|Configure|Set|Build|Use|Check|Verify|Ensure)\b/.test(
        body
      );
    drifts.push({
      drifted: !hasImperative,
      category: "Voice",
      detail: hasImperative
        ? 'Uses imperative voice ("Do X" not "You might X")'
        : "Passive or suggestive phrasing — use direct imperatives",
    });

    // Example drift: should include code blocks
    const hasCode = body.includes("```");
    drifts.push({
      drifted: !hasCode,
      category: "Example",
      detail: hasCode
        ? "Has code examples"
        : "No code blocks found — add examples if the skill involves code",
    });

    // Guardrail drift: should have explicit constraints
    const hasConstraints =
      /\bMUST\b/.test(body) || /\bMUST NOT\b/.test(body);
    drifts.push({
      drifted: !hasConstraints,
      category: "Guardrail",
      detail: hasConstraints
        ? "Has MUST/MUST NOT constraints"
        : "No explicit constraints — add MUST / MUST NOT guardrails",
    });

    // Clarity drift: should avoid ambiguous language
    const ambiguous = body.match(
      /\b(maybe|possibly|consider|you might want to|perhaps)\b/gi
    );
    const hasDriftedClarity = ambiguous && ambiguous.length > 0;
    drifts.push({
      drifted: !!hasDriftedClarity,
      category: "Clarity",
      detail: hasDriftedClarity
        ? `Ambiguous phrasing detected: ${ambiguous!.slice(0, 3).join(", ")}`
        : "No ambiguous language found",
    });

    const driftCount = drifts.filter((d) => d.drifted).length;
    const total = drifts.length;

    if (args.format === "json") {
      console.log(
        JSON.stringify(
          { path: targetPath, driftCount, total, drifts },
          null,
          2
        )
      );
    } else {
      console.error(
        `\n  ${pc.bold("doraval skill drift")} — Measuring rubric drift\n`
      );
      console.error(`  Path:  ${targetPath}\n`);

      for (const d of drifts) {
        const icon = d.drifted ? pc.yellow("↗") : pc.green("·");
        const cat = d.drifted
          ? pc.yellow(d.category.padEnd(10))
          : pc.dim(d.category.padEnd(10));
        console.log(`  ${icon} ${cat} ${d.detail}`);
      }

      if (driftCount === 0) {
        console.log(
          `\n  ${pc.green("No drift detected.")} Skill aligns with rubric standards.\n`
        );
      } else {
        console.log(
          `\n  ${pc.yellow(`${driftCount}/${total}`)} rubric areas have drifted.\n`
        );
      }
    }
  },
});
