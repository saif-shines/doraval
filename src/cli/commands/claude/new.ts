import { defineCommand } from "citty";
import { ui } from "../../out.js";
import { detectContext } from "./context.js";
import { prompt } from "../../prompt.js";
import pc from "picocolors";
import { join } from "path";
import { mkdirSync, writeFileSync, existsSync } from "fs";

export type Intent = "self" | "self-later" | "distribute";

export interface Decision {
  path: "standalone" | "plugin";
  targetDir: string;
  shouldCreateDir: boolean;
  migrateExisting: boolean;
}

export function decidePath(ctx: ReturnType<typeof import("./context.js").detectContext>, intent: Intent | undefined, providedName?: string): Decision {
  const name = providedName || "my-skill";
  let path: "standalone" | "plugin" = "standalone";
  let targetDir = ctx.cwd;
  let shouldCreateDir = false;
  let migrateExisting = false;

  if (intent === "distribute" || (intent === "self-later" && ctx.looseSkillFiles.length > 0 && !ctx.hasClaudeDir)) {
    path = "plugin";
    targetDir = join(ctx.cwd, `${name}-plugin`);
    shouldCreateDir = true;
    migrateExisting = ctx.looseSkillFiles.length > 0;
  } else if (intent === "self-later" && !ctx.hasClaudeDir) {
    // Could default to standalone with note, but per spec use plugin sibling for loose case
    path = "plugin";
    targetDir = join(ctx.cwd, `${name}-plugin`);
    shouldCreateDir = true;
  }

  return { path, targetDir, shouldCreateDir, migrateExisting };
}

export function scaffold(decision: Decision, ctx: any, migrateContent?: string) {
  const { targetDir, path, shouldCreateDir } = decision;

  if (existsSync(targetDir) && shouldCreateDir) {
    ui.fail("Target already exists");
    process.exit(1);
  }

  if (shouldCreateDir) {
    mkdirSync(targetDir, { recursive: true });
  }

  if (path === "plugin") {
    const pluginJson = {
      name: decision.targetDir.split("/").pop(),
      description: "Scaffolded by doraval claude new",
      version: "0.1.0",
    };
    mkdirSync(join(targetDir, ".claude-plugin"), { recursive: true });
    writeFileSync(join(targetDir, ".claude-plugin", "plugin.json"), JSON.stringify(pluginJson, null, 2));

    mkdirSync(join(targetDir, "skills", "my-skill"), { recursive: true });
    const skillBody = migrateContent || "# My Skill\n\nBasic starter skill.";
    writeFileSync(join(targetDir, "skills", "my-skill", "SKILL.md"), `---\nname: my-skill\ndescription: Starter skill\n---\n\n${skillBody}`);

    writeFileSync(join(targetDir, "README.md"), "# " + pluginJson.name + "\n\nClaude Code plugin scaffolded by doraval.");
  } else {
    // standalone
    mkdirSync(join(targetDir, ".claude", "skills", "my-skill"), { recursive: true });
    const skillBody = migrateContent || "# My Skill\n\nBasic starter.";
    writeFileSync(join(targetDir, ".claude", "skills", "my-skill", "SKILL.md"), `---\nname: my-skill\ndescription: Starter\n---\n\n${skillBody}`);
  }
}

export default defineCommand({
  meta: {
    name: "new",
    description: "Create a new skill or plugin following Claude Code packaging rules",
  },
  args: {
    name: {
      type: "positional",
      description: "Optional name for the skill or plugin",
      required: false,
    },
    yes: {
      type: "boolean",
      description: "Skip interactive prompts (use defaults and flags)",
      default: false,
    },
    intent: {
      type: "string",
      description: 'Intent: "self" | "self-later" | "distribute"',
      required: false,
    },
  },
  run({ args }) {
    ui.heading("doraval claude new — Context-aware scaffolding (stub)");
    const ctx = detectContext();
    let intent: Intent = (args.intent as Intent) || "self-later";
    if (!args.yes) {
      // Simplified prompt for now; full questions later
      const ans = prompt("  Intent (self | self-later | distribute)", intent);
      intent = (ans as Intent) || intent;
    }

    const decision = decidePath(ctx, intent, args.name as string | undefined);

    ui.info(`  Decision: path=${decision.path}, target=${decision.targetDir}`);

    let migrateContent: string | undefined;
    if (decision.migrateExisting && !args.yes) {
      // Simplified; in real use read the first loose file
      migrateContent = "Content from your existing SKILL.md (user-confirmed).";
    }

    scaffold(decision, ctx, migrateContent);
    ui.write(`\n  ${pc.green("✓")} Created ${decision.path} at ${pc.bold(decision.targetDir)}`);
    ui.info(`  Command: ${decision.path === "plugin" ? `/${decision.targetDir.split("/").pop()}:my-skill` : "/my-skill"}`);
    ui.info(`  Test: claude --plugin-dir ${decision.targetDir}   (or use normally for standalone)`);
    ui.info(`  Validate: doraval validate ${decision.targetDir}`);
    if (decision.path === "plugin" && decision.migrateExisting) {
      ui.info("  (Existing content migrated where confirmed.)");
    }
    process.exit(0);
  },
});
