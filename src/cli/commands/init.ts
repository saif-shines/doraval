import { defineCommand } from "citty";
import { basename, join } from "path";
import { spawnSync } from "bun";
import pc from "picocolors";
import { ui } from "../out.js";
import {
  readConfig,
  writeConfig,
  ensureDoravalDirs,
  getJournalsDir,
  sanitizeProjectName,
  type JournalConfig,
} from "../../core/journal-config.js";
import {
  ensureGhCli,
  refreshLocalJournalFile,
  getGitRemoteOwner,
  ghUser,
  repoExists,
} from "../../core/journal-remote.js";
import { prompt } from "../prompt.js";

export default defineCommand({
  meta: {
    name: "init",
    description: "One-time setup for doraval + journal (decisions + notes) + your coding agent (recommended starting point)",
  },
  args: {
    repo: {
      type: "string",
      alias: "r",
      description: "Journal repo (owner/name). Smart default from git remote or gh account. Env: DORAVAL_JOURNAL_REPO",
    },
    project: {
      type: "string",
      alias: "p",
      description: "Project name (default: basename of current directory)",
    },
    refresh: {
      type: "boolean",
      description: "Re-fetch journal files even if the project is already registered",
      default: false,
    },
  },

  async run({ args }) {
    ui.heading("dora init — Set up doraval, your journal, and the coding agent dora should use on the fly");
    ui.write(`  ${pc.bold(pc.white("Step 1: Journal setup"))}\n`);

    const ghCheck = ensureGhCli();
    if (!ghCheck.ok) {
      ui.write(`  ${pc.red("✗")} ${pc.white("The GitHub CLI (")}${pc.bold("gh")}${pc.white(") is not installed.")}\n`);
      ui.info(`  doraval uses ${pc.bold("gh")} to fetch and sync journal files with GitHub.\n`);
      ui.info(`  Install it:\n`);
      ui.info(`    macOS:   ${pc.dim("brew install gh")}`);
      ui.info(`    Linux:   ${pc.dim("https://github.com/cli/cli/blob/trunk/docs/install_linux.md")}`);
      ui.info(`    Windows: ${pc.dim("winget install --id GitHub.cli")}\n`);
      ui.info(`  Then authenticate: ${pc.dim("gh auth login")}\n`);
      process.exit(1);
    }

    let repo = (args.repo as string | undefined) || process.env.DORAVAL_JOURNAL_REPO;

    if (!repo) {
      const gitOwner = getGitRemoteOwner();
      const ghLogin = ghUser();

      let defaultRepo: string;
      let sourceNote = "";

      if (gitOwner) {
        defaultRepo = `${gitOwner}/${gitOwner}.md`;
        if (ghLogin && ghLogin !== gitOwner) {
          sourceNote = `  ${pc.dim("(from git remote; your active gh account is " + ghLogin + ")")}\n`;
        } else {
          sourceNote = `  ${pc.dim("(from git remote)")}\n`;
        }
      } else if (ghLogin) {
        defaultRepo = `${ghLogin}/${ghLogin}.md`;
        sourceNote = `  ${pc.dim("(from your active gh account)")}\n`;
      } else {
        ui.warn(`Not logged in to GitHub. Run ${pc.dim("gh auth login")} first.\n`);
        process.exit(1);
      }

      const existingConfig = await readConfig();
      if (existingConfig?.journal.repo) {
        defaultRepo = existingConfig.journal.repo;
        sourceNote = `  ${pc.dim("(from your previous journal setup)")}\n`;
      }

      ui.info(`  Journal repo ${pc.dim("(owner/name)")}`);
      if (sourceNote) ui.write(sourceNote);
      repo = prompt("  >", defaultRepo);
    }

    let project = (args.project as string | undefined) || process.env.DORAVAL_PROJECT;
    if (!project) {
      const defaultProject = basename(process.cwd());
      project = prompt("  Project name", defaultProject);
    }
    project = sanitizeProjectName(project);

    if (!repoExists(repo!)) {
      ui.write(`  ${pc.red("✗")} ${pc.white("Repository")} ${pc.bold(repo!)} ${pc.white("not found on GitHub.")}\n`);
      ui.info(`  Create it first:\n`);
      ui.info(`    ${pc.dim(`gh repo create ${repo} --private --description "Personal journal for agent decisions"`)}\n`);
      process.exit(1);
    }

    const existing = await readConfig();
    const alreadyRegistered = existing?.journal.projects[project];
    const isRefresh = alreadyRegistered && args.refresh;

    if (alreadyRegistered && !isRefresh) {
      ui.write(`  ${pc.yellow("⚠")} ${pc.white("Project")} ${pc.bold(project)} ${pc.white("is already registered.")}\n`);
      ui.info(`  Repo:   ${existing.journal.repo}\n`);
      ui.info(`  To refresh journal files, use ${pc.dim("dora journal update")} (or ${pc.dim("dora init --refresh")}).\n`);
    }

    const journalsDir = getJournalsDir();
    const remotePath = `projects/${project}.md`;
    const localPath = join(journalsDir, `${project}.md`);

    const effectiveRepo = isRefresh && !args.repo ? existing!.journal.repo : repo!;

    const config: JournalConfig = existing ?? {
      journal: { repo: effectiveRepo, projects: {} },
    };
    config.journal.repo = effectiveRepo;
    config.journal.projects[project] = {
      remote_path: remotePath,
      local_path: localPath,
    };

    ensureDoravalDirs();

    ui.write(`  ${pc.dim(pc.gray("Fetching journal files from"))} ${pc.gray(effectiveRepo)}${pc.dim(pc.gray("..."))}\n`);

    const globalDest = join(journalsDir, "global.md");
    const refreshGlobalRes = await refreshLocalJournalFile(effectiveRepo, "global.md", globalDest);
    let wroteGlobal: boolean;
    if (!refreshGlobalRes.ok) {
      if (refreshGlobalRes.isNotFound) {
        wroteGlobal = false;
      } else {
        ui.fail(`Failed to fetch global.md from ${effectiveRepo}:`);
        ui.info(refreshGlobalRes.error);
        process.exit(1);
      }
    } else {
      wroteGlobal = refreshGlobalRes.value;
    }
    if (wroteGlobal) {
      ui.success("global.md");
    } else {
      ui.write(`  ${pc.dim("·")} global.md ${pc.dim("(not found — will be created on first sync)")}`);
      await Bun.write(globalDest, "# Global Journal\n\nCross-project principles.\n");
    }

    const refreshProjectRes = await refreshLocalJournalFile(effectiveRepo, remotePath, localPath);
    let wroteProject: boolean;
    if (!refreshProjectRes.ok) {
      if (refreshProjectRes.isNotFound) {
        wroteProject = false;
      } else {
        ui.fail(`Failed to fetch ${remotePath} from ${effectiveRepo}:`);
        ui.info(refreshProjectRes.error);
        process.exit(1);
      }
    } else {
      wroteProject = refreshProjectRes.value;
    }
    if (wroteProject) {
      ui.success(remotePath);
    } else {
      ui.write(`  ${pc.dim("·")} ${remotePath} ${pc.dim("(not found — will be created on first sync)")}`);
      await Bun.write(localPath, `# ${project} Journal\n\nProject-specific decisions.\n`);
    }

    await writeConfig(config);

    ui.write(`\n  ${pc.green("✓")} ${pc.white("Journal ready for project")} ${pc.bold(pc.white(project))}.\n`);

    const existingAgent = (await readConfig())?.agent;
    if (existingAgent?.command) {
      ui.write(`  ${pc.bold(pc.white("Coding agent (already configured)"))}\n`);
      ui.write(`    Current: ${pc.dim(pc.gray(existingAgent.command))}  template: ${pc.dim(pc.gray(existingAgent.prompt_template || "(default)"))}\n`);
      const change = prompt("  Reconfigure / change the coding agent for on-the-fly enrichment? (y/N)", "n");
      if (!/^y/i.test(String(change))) {
        ui.dim("  Keeping existing agent config. You can re-run dora init later to change it.\n");
        const cfg = (await readConfig()) || { journal: { repo: effectiveRepo, projects: {} } };
        if (existingAgent) cfg.agent = existingAgent;
        await writeConfig(cfg);
        ui.write(`  ${pc.green("✓")} ${pc.white("Try:")} ${pc.dim(pc.gray("dora journal add \"short decision\""))}\n`);
        process.exit(0);
        return;
      }
      ui.blank();
    } else {
      ui.write(`\n  ${pc.bold(pc.white("Step 2: Coding agent for journal add"))}\n`);
      ui.info(`  When configured, ${pc.dim(pc.gray("dora journal add \"..\""))} will use your agent to enrich entries with tags and rationale automatically.\n`);
    }

    const common = [
      { name: "claude", template: '-p "{{prompt}}" --output-format json' },
      { name: "cursor", template: '' },
    ];

    let detected = "";
    for (const c of common) {
      let probe = spawnSync(["command", "-v", c.name], { stdout: "pipe", stderr: "pipe" });
      if (probe.exitCode !== 0) {
        probe = spawnSync(["which", c.name], { stdout: "pipe", stderr: "pipe" });
      }
      if (probe.exitCode === 0) {
        detected = c.name;
        break;
      }
    }

    let agentCmd = detected || "claude";
    ui.write(`  Detected / default agent command: ${pc.dim(pc.gray(agentCmd))}`);
    agentCmd = prompt("  Agent command (the binary you run for prompts)", agentCmd);

    let template = detected ? (common.find(c => c.name === detected)?.template || '-p "{{prompt}}" --output-format json') : '-p "{{prompt}}" --output-format json';
    ui.info(`  Prompt template (use {{prompt}} placeholder):`);
    template = prompt("  ", template);

    const finalConfig: JournalConfig = (await readConfig()) || { journal: { repo: effectiveRepo, projects: {} } };
    finalConfig.agent = {
      command: agentCmd,
      prompt_template: template,
    };
    await writeConfig(finalConfig);

    ui.write(`\n  ${pc.green("✓")} ${pc.white("Agent configured.")}\n`);
    ui.info(`  Re-run ${pc.dim(pc.gray("dora init"))} anytime to change it.\n`);

    // ── Eval setup ──────────────────────────────────────────────────────────────
    ui.write(`\n  ${pc.bold("Step 3: Eval configuration (doraval eval)")}\n`);

    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    if (hasAnthropic || hasOpenAI) {
      ui.success("API key found in environment — will be used for eval.");
    } else {
      ui.warn("No ANTHROPIC_API_KEY or OPENAI_API_KEY set. Set the right one before running doraval eval.");
    }

    const evalModelAnswer = await prompt(
      `  Which model should doraval eval use? ${pc.dim("(e.g. claude-sonnet-4-6 or gpt-4o, press Enter to skip)")} `,
      ""
    );

    if (evalModelAnswer.trim()) {
      const updatedConfig2 = await readConfig();
      if (updatedConfig2) {
        (updatedConfig2 as Record<string, unknown>).eval = {
          model: evalModelAnswer.trim(),
          max_tool_calls: 200,
          save_history: true,
        };
        await writeConfig(updatedConfig2 as Parameters<typeof writeConfig>[0]);
        ui.success(`eval.model set to ${evalModelAnswer.trim()}`);
      }
    } else {
      ui.dim("  Skipped. Run: dora config set eval.model <model-name>");
    }

    ui.info(`  Next: ${pc.dim(pc.gray("dora journal add \"..\""))}, ${pc.dim(pc.gray("dora journal list"))}, or ${pc.dim(pc.gray("dora journal update"))}.\n`);

    process.exit(0);
  },
});
