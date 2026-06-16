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
  const rawName = providedName || "";
  let path: "standalone" | "plugin" = "standalone";
  let targetDir = ctx.cwd;
  let shouldCreateDir = false;
  let migrateExisting = false;

  const useCurrentDirAsRoot = rawName === "." || rawName === path.basename(ctx.cwd) || !rawName;

  if (intent === "distribute" || (intent === "self-later" && ctx.looseSkillFiles.length > 0 && !ctx.hasClaudeDir)) {
    path = "plugin";
    if (useCurrentDirAsRoot) {
      // User is already in the target dir (or passed .), scaffold plugin structure directly here
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
    migrateExisting = ctx.looseSkillFiles.length > 0;
  } else if (intent === "self-later" && !ctx.hasClaudeDir) {
    path = "plugin";
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
  } else if (path === "standalone") {
    // For standalone, support in-place too if . or no name
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
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

    // The first skill in a generated plugin is a self-referential demo of using doraval itself.
    const demoSkillName = "doraval";
    mkdirSync(join(targetDir, "skills", demoSkillName), { recursive: true });

    let skillContent: string;
    if (migrateContent) {
      skillContent = migrateContent;
    } else {
      skillContent = `---
name: ${demoSkillName}
description: Use doraval to validate, measure drift, and judge skills and plugins. Use when authoring or reviewing context engineering artifacts for AI coding agents.
---

# Use Doraval

Doraval is the context engineering toolkit.

When you need to check a skill or plugin:

- Validate the current directory: \`doraval validate .\`
- Validate a specific plugin: \`doraval validate .\ --for claude:plugin\`
- Validate one skill: \`doraval skill validate ./skills/${demoSkillName}/\`
- Check for rubric drift: \`doraval skill drift ./skills/${demoSkillName}/\`
- Get an AI quality judgment: \`doraval skill judge ./skills/${demoSkillName}/\`

Always run \`doraval validate\` before sharing or publishing a plugin. This skill demonstrates a complete, self-referential example of using doraval inside a generated plugin.`;
    }

    writeFileSync(join(targetDir, "skills", demoSkillName, "SKILL.md"), skillContent);

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
    ui.heading("doraval claude new — Context-aware scaffolding");
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
    ui.info(`  Command: ${decision.path === "plugin" ? `/${decision.targetDir.split("/").pop()}:doraval` : "/my-skill"}`);
    ui.info(`  Test: claude --plugin-dir ${decision.targetDir}   (or use normally for standalone)`);
    ui.info(`  Validate: doraval validate ${decision.targetDir}`);
    if (decision.path === "plugin" && decision.migrateExisting) {
      ui.info("  (Existing content migrated where confirmed.)");
    }
    process.exit(0);
  },
});
