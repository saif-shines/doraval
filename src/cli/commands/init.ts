import { defineCommand } from "citty";
import { basename, join } from "path";
import { spawnSync } from "bun";
import pc from "picocolors";
import { ui, guidedError } from "../out.js";
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
import {
  intro,
  outro,
  text,
  confirm,
  select,
  isCancel,
  spinner,
  cancel,
  note,
} from '@clack/prompts';

export default defineCommand({
  meta: {
    name: "init",
    description: "One-time setup for decision memory (journal) and agent integration when scaling AI context (skills, plugins, etc.)",
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
    ui.heading("dora init — Set up decision memory and agent integration for scaling AI context");

    const isInteractive = process.stdout.isTTY && !process.env.CI;

    if (isInteractive) {
      intro('dora init — decision memory (journal) + agent integration for scaling AI context');
    }

    ui.write(`  ${pc.bold(pc.white("Step 1: Decision memory (journal)"))}\n`);

    if (isInteractive) {
      note('The journal remembers decisions and principles so you (and agents) can reliably scale AI context through skills, plugins, and more.');
    } else {
      ui.info(`  The journal remembers decisions and principles so you (and agents) can reliably scale AI context through skills, plugins, and more.\n`);
    }

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
        sourceNote = `  ${pc.dim("(from your previous decision memory setup)")}\n`;
      }

      ui.info(`  Journal repo ${pc.dim("(owner/name)")}`);
      if (sourceNote) ui.write(sourceNote);

      if (isInteractive) {
        const result = await text({
          message: 'Journal repo (owner/name) — this will remember your decisions and principles',
          placeholder: defaultRepo,
          initialValue: defaultRepo,
          validate(value) {
            if (!value) return 'Repository is required';
            return undefined;
          },
        });
        if (isCancel(result)) {
          cancel('Setup cancelled.');
          process.exit(0);
        }
        repo = result;
      } else {
        repo = defaultRepo;
        ui.info(`  Using default (non-interactive): ${repo}`);
      }
    }

    let project = (args.project as string | undefined) || process.env.DORAVAL_PROJECT;
    if (!project) {
      const defaultProject = basename(process.cwd());

      if (isInteractive) {
        const result = await text({
          message: 'Project name (decisions for this project will live in the journal)',
          placeholder: defaultProject,
          initialValue: defaultProject,
          validate(value) {
            if (!value) return 'Project name is required';
            return undefined;
          },
        });
        if (isCancel(result)) {
          cancel('Setup cancelled.');
          process.exit(0);
        }
        project = result;
      } else {
        project = defaultProject;
        ui.info(`  Using default (non-interactive): ${project}`);
      }
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

    const s = spinner();
    if (isInteractive) s.start('Fetching from GitHub');

    const globalDest = join(journalsDir, "global.md");
    const refreshGlobalRes = await refreshLocalJournalFile(effectiveRepo, "global.md", globalDest);
    let wroteGlobal: boolean;
    if (!refreshGlobalRes.ok) {
      if (refreshGlobalRes.isNotFound) {
        wroteGlobal = false;
      } else {
        if (isInteractive) s.stop('Failed');
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
        if (isInteractive) s.stop('Failed');
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

    if (isInteractive) s.stop('Done');

    await writeConfig(config);

    ui.write(`\n  ${pc.green("✓")} ${pc.white("Journal ready for project")} ${pc.bold(pc.white(project))}.\n`);

    const existingAgent = (await readConfig())?.agent;
    if (existingAgent?.command) {
      ui.write(`  ${pc.bold(pc.white("Coding agent (already configured)"))}\n`);
      ui.write(`    Current: ${pc.dim(pc.gray(existingAgent.command))}  template: ${pc.dim(pc.gray(existingAgent.prompt_template || "(default)"))}  cwd_flag: ${pc.dim(pc.gray(existingAgent.cwd_flag || "(none)"))}\n`);

      let shouldReconfigure = false;
      if (isInteractive) {
        const change = await confirm({
          message: 'Reconfigure / change the coding agent for on-the-fly enrichment?',
          initialValue: false,
        });
        if (isCancel(change)) {
          cancel('Setup cancelled.');
          process.exit(0);
        }
        shouldReconfigure = !!change;
      }

      if (!shouldReconfigure) {
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
      ui.write(`\n  ${pc.bold(pc.white("Step 2: Coding agent integration"))}\n`);
      if (isInteractive) {
        note('Configure the agent that will help you capture and enrich decisions/principles as you scale AI context through skills and plugins.');
      } else {
        ui.info(`  Configure the agent that will help you capture and enrich decisions/principles as you scale AI context through skills and plugins.\n`);
      }
    }

    const common = [
      { name: "claude", template: '-p "{{prompt}}" --output-format json --bare', cwd_flag: "" },
      { name: "grok", template: '-p "{{prompt}}" --no-auto-update --no-alt-screen --always-approve', cwd_flag: "--cwd" },
      { name: "cursor", template: '', cwd_flag: "" },
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
    let template = detected ? (common.find(c => c.name === detected)?.template || '-p "{{prompt}}"') : '-p "{{prompt}}"';
    let cwdFlag = (common.find(c => c.name === detected)?.cwd_flag) ?? "";

    if (isInteractive) {
      ui.write(`  Detected / default agent command: ${pc.dim(pc.gray(agentCmd))}`);

      const agentOptions = [
        ...common.map((c) => ({
          value: c.name,
          label: `${c.name}${detected === c.name ? ' (detected)' : ''}`,
        })),
        { value: 'custom', label: 'Custom command' },
      ];

      const agentChoice = await select({
        message: 'Agent command — the one you use for coding (doraval will use it to help remember decisions)',
        options: agentOptions,
        initialValue: detected || 'claude',
      });
      if (isCancel(agentChoice)) {
        cancel('Setup cancelled.');
        process.exit(0);
      }

      if (agentChoice === 'custom') {
        const custom = await text({
          message: 'Agent command',
          initialValue: agentCmd,
        });
        if (isCancel(custom)) {
          cancel('Setup cancelled.');
          process.exit(0);
        }
        agentCmd = custom;
      } else {
        agentCmd = agentChoice;
      }

      // refresh template/cwd based on choice
      const chosen = common.find((c) => c.name === agentCmd) || { template: '-p "{{prompt}}"', cwd_flag: '' };
      template = chosen.template;
      cwdFlag = chosen.cwd_flag ?? '';

      ui.info(`  Prompt template (use {{prompt}} placeholder):`);
      const tpl = await text({
        message: 'Prompt template (how doraval will ask your agent to help with decisions)',
        initialValue: template,
      });
      if (isCancel(tpl)) {
        cancel('Setup cancelled.');
        process.exit(0);
      }
      template = tpl;

      if (agentCmd !== 'cursor') {
        const flag = await text({
          message: 'Cwd flag your agent uses (e.g. --cwd; so it works on the right project when helping with decisions)',
          initialValue: cwdFlag,
        });
        if (isCancel(flag)) {
          cancel('Setup cancelled.');
          process.exit(0);
        }
        cwdFlag = flag;
      }
    } else {
      ui.info(`  Using non-interactive defaults for agent: ${agentCmd}`);
    }

    const finalConfig: JournalConfig = (await readConfig()) || { journal: { repo: effectiveRepo, projects: {} } };
    finalConfig.agent = {
      command: agentCmd,
      prompt_template: template,
      ...(cwdFlag ? { cwd_flag: cwdFlag } : {}),
    };
    await writeConfig(finalConfig);

    ui.write(`\n  ${pc.green("✓")} ${pc.white("Agent configured.")}\n`);
    ui.info(`  Re-run ${pc.dim(pc.gray("dora init"))} anytime to change it.\n`);

    // ── Eval setup ──────────────────────────────────────────────────────────────
    ui.write(`\n  ${pc.bold("Step 3: Evaluation setup")}\n`);

    if (isInteractive) {
      note('Optional model so you can verify that agents are following your decisions and principles while scaling AI context.');
    } else {
      ui.info(`  Optional model so you can verify that agents are following your decisions and principles while scaling AI context.\n`);
    }

    const hasApiKey = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.ZHIPU_API_KEY || process.env.GLM_API_KEY);
    if (hasApiKey) {
      ui.success("API key found — doraval eval can call models directly (no proxy server needed). GLM works great for cheap dev evals.");
    } else {
      guidedError({
        context: "doraval eval can judge using your agent CLI (always works) or call an LLM API directly (faster, cheaper, no local agent needed for judging).",
        problem: "No API key detected for direct eval judging",
        solutions: [
          "Set OPENAI_API_KEY or ZAI_API_KEY (or ANTHROPIC_*) and choose a model below",
          "Skip — eval will fall back to your configured agent CLI",
        ],
      });
    }

    let evalModelAnswer = '';

    if (isInteractive) {
      const model = await text({
        message: 'Which model should doraval eval use? (to check if agents follow your decisions/principles)',
        placeholder: 'glm-4, gpt-4o-mini, claude-3-5-sonnet-20241022',
        initialValue: '',
      });
      if (isCancel(model)) {
        cancel('Setup cancelled.');
        process.exit(0);
      }
      evalModelAnswer = model;
    }

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
      ui.info("  Skipped. You can set later with: dora config set eval.model <model>");
      ui.info("  Eval will still work via your agent CLI.");
    }

    if (isInteractive) {
      outro('Setup complete. Your journal will now remember decisions and principles as you scale AI context.');
    } else {
      ui.info(`  Next: ${pc.dim(pc.gray("dora journal add \"..\""))} to record decisions while scaling context.\n`);
    }

    process.exit(0);
  },
});
