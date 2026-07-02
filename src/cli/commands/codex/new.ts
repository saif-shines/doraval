import { defineCommand } from "citty";
import { ui } from "../../out.js";
import { detectContext } from "./context.js";
import { prompt } from "../../prompt.js";
import pc from "picocolors";
import { join, basename, dirname } from "path";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { getProviderSpec } from "../../../providers/spec.js";
import { exit } from "../../render/exit.js";

export type Intent = "self" | "self-later" | "distribute";

export interface Decision {
  path: "standalone" | "plugin";
  targetDir: string;
  shouldCreateDir: boolean;
  migrateExisting: boolean;
}

export function decidePath(ctx: ReturnType<typeof import("./context.js").detectContext>, intent: Intent | undefined, providedName?: string): Decision {
  const rawName = providedName || "";
  let decisionPath: "standalone" | "plugin" = "standalone";
  let targetDir = ctx.cwd;
  let shouldCreateDir = false;
  let migrateExisting = false;

  const useCurrentDirAsRoot = rawName === "." || rawName === basename(ctx.cwd) || !rawName;

  if (intent === "distribute" || (intent === "self-later" && ctx.looseSkillFiles.length > 0 && !ctx.hasPluginManifest)) {
    decisionPath = "plugin";
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
    migrateExisting = ctx.looseSkillFiles.length > 0;
  } else if (intent === "self-later" && !ctx.hasPluginManifest) {
    decisionPath = "plugin";
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
  } else if (decisionPath === "standalone") {
    if (useCurrentDirAsRoot) {
      targetDir = ctx.cwd;
      shouldCreateDir = false;
    } else {
      targetDir = join(ctx.cwd, rawName);
      shouldCreateDir = true;
    }
  }

  return { path: decisionPath, targetDir, shouldCreateDir, migrateExisting };
}

export async function scaffold(decision: Decision, ctx: any, migrateContent?: string) {
  const { targetDir, path, shouldCreateDir } = decision;

  if (existsSync(targetDir) && shouldCreateDir) {
    ui.fail("Target already exists");
    return await exit(1);
  }

  if (shouldCreateDir) {
    mkdirSync(targetDir, { recursive: true });
  }

  if (path === "plugin") {
    const pluginName = basename(targetDir);

    const codexSpec = getProviderSpec("codex");
    const codexManifestDir = dirname(codexSpec.manifestPath);

    // .codex-plugin/plugin.json per Codex Build plugins docs
    const pluginJson = {
      name: pluginName,
      version: "0.1.0",
      description: "Scaffolded by doraval codex new",
      skills: "./skills/",
      interface: {
        displayName: pluginName,
        shortDescription: "Scaffolded starter plugin",
        category: "Productivity",
      },
      keywords: ["example-keyword", "another-keyword"],
    };
    mkdirSync(join(targetDir, codexManifestDir), { recursive: true });
    writeFileSync(join(targetDir, codexSpec.manifestPath), JSON.stringify(pluginJson, null, 2));

    // Starter local marketplace catalog (Codex convention: .agents/plugins/marketplace.json)
    // One entry for this plugin. `path` is relative to the marketplace file.
    // When the marketplace lives at <plugin>/.agents/plugins/marketplace.json,
    // "../.." points back at the plugin root (where .codex-plugin lives).
    // For repo-wide use, move this marketplace.json to your $REPO_ROOT/.agents/plugins/
    // and update the path accordingly (e.g. "./plugins/this-plugin").
    const marketplaceDir = dirname(codexSpec.marketplacePath);
    mkdirSync(join(targetDir, marketplaceDir), { recursive: true });
    const marketplaceJson = {
      name: "local",
      interface: {
        displayName: "Local (doraval scaffold)",
      },
      plugins: [
        {
          name: pluginName,
          source: {
            source: "local",
            path: "../..",
          },
          policy: {
            installation: "AVAILABLE",
            authentication: "ON_INSTALL",
          },
          category: "Productivity",
        },
      ],
    };
    writeFileSync(
      join(targetDir, codexSpec.marketplacePath),
      JSON.stringify(marketplaceJson, null, 2)
    );

    // The first skill in a generated plugin is a self-referential demo of using doraval itself.
    const demoSkillName = "doraval";
    mkdirSync(join(targetDir, "skills", demoSkillName), { recursive: true });

    let skillContent: string;
    if (migrateContent) {
      skillContent = migrateContent;
    } else {
      skillContent = `---
name: ${demoSkillName}
description: Use doraval to validate, measure drift, and judge skills and plugins. Use when authoring or reviewing context engineering artifacts for AI coding agents (works for Codex too).
---

# Use Doraval (Codex edition)

Scale your AI context for coding agents. Make your next context work (skills, plugins & more) for your team, community, or self. Context engineering toolkit for AI coding agents.

When you need to check a skill or Codex plugin:

- Validate the current directory: \`doraval validate .\`
- Validate one skill: \`doraval skill validate ./skills/${demoSkillName}/\`
- Check for rubric drift: \`doraval skill drift ./skills/${demoSkillName}/\`
- Get an AI quality judgment: \`doraval skill judge ./skills/${demoSkillName}/\`

Always run \`doraval validate\` before sharing or publishing a plugin.

This skill demonstrates a complete, self-referential example of using doraval inside a generated Codex plugin.

To test in Codex:
1. Make sure this plugin is listed in a marketplace (we created .agents/plugins/marketplace.json for you).
2. Restart Codex.
3. Open the plugin directory, select your local marketplace, and enable the plugin.
4. Invoke the demo with /${pluginName}:doraval`;
    }

    writeFileSync(join(targetDir, "skills", demoSkillName, "SKILL.md"), skillContent);

    const readmePath = join(targetDir, "README.md");
    if (!existsSync(readmePath)) {
      writeFileSync(readmePath, "# " + pluginName + "\n\nCodex plugin scaffolded by doraval.");
    }
  } else {
    // "standalone" / local skill start for Codex (per "start with a local skill")
    mkdirSync(join(targetDir, "skills", "doraval"), { recursive: true });
    const skillBody = migrateContent || "# My Skill\n\nBasic starter for Codex.";
    writeFileSync(join(targetDir, "skills", "doraval", "SKILL.md"), `---\nname: doraval\ndescription: Starter (local skill)\n---\n\n${skillBody}`);
  }
}

export default defineCommand({
  meta: {
    name: "new",
    description: "Create a new skill or plugin following Codex packaging rules",
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
  async run({ args }) {
    ui.heading("doraval codex new — Context-aware scaffolding");
    const ctx = detectContext();
    let intent: Intent = (args.intent as Intent) || "self-later";
    if (!args.yes) {
      const ans = prompt("  Intent (self | self-later | distribute)", intent);
      intent = (ans as Intent) || intent;
    }

    const decision = decidePath(ctx, intent, args.name as string | undefined);

    ui.info(`  Decision: path=${decision.path}, target=${decision.targetDir}`);

    let migrateContent: string | undefined;
    if (decision.migrateExisting && !args.yes) {
      migrateContent = "Content from your existing SKILL.md (user-confirmed).";
    }

    await scaffold(decision, ctx, migrateContent);
    ui.write(`\n  ${pc.green("✓")} Created ${decision.path} at ${pc.bold(decision.targetDir)}`);
    const cmdName = decision.path === "plugin" ? `/${basename(decision.targetDir)}:doraval` : "/doraval (local skill)";
    ui.info(`  Command: ${cmdName}`);
    if (decision.path === "plugin") {
      ui.info(`  Codex manifest: .codex-plugin/plugin.json`);
      ui.info(`  Marketplace catalog: .agents/plugins/marketplace.json (starter for local testing)`);
      ui.info(`  (Move/expand the marketplace.json to $REPO_ROOT/.agents/plugins/ or ~/.agents/plugins/ as needed)`);
    }
    ui.info(`  Test (local): restart Codex, select your marketplace in the plugin directory`);
    ui.info(`  Validate: doraval validate ${decision.targetDir}`);
    if (decision.path === "plugin") {
      ui.info(`  Keywords: keywords array added for discovery — run validate to see "If users mention any of these keywords, your plugin will get triggered"`);
    }
    if (decision.path === "plugin" && decision.migrateExisting) {
      ui.info("  (Existing content migrated where confirmed.)");
    }
    await exit(0);
  },
});
