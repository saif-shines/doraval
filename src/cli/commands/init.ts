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
  type EvalConfig,
} from "../../core/journal-config.js";
import {
  ensureGhCli,
  refreshLocalJournalFile,
  getGitRemoteOwner,
  ghUser,
  repoExists,
} from "../../core/journal-remote.js";
import { hasDirectApiCredentials, resolveDirectCredentials } from "../../core/llm-judge.js";
import { PROVIDERS, detectEnvProvider, fetchProviderModels } from "../../core/providers.js";
import { getDefaultPromptTemplate } from "../../core/agent-invoke.js";
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
  password,
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
      // Track mismatch for better repoExists error messages
      let accountMismatch = false;

      if (gitOwner) {
        defaultRepo = `${gitOwner}/${gitOwner}.md`;
        if (ghLogin && ghLogin !== gitOwner) {
          accountMismatch = true;
          sourceNote = `  ${pc.dim("(from git remote; active gh account is " + ghLogin + ")")}\n`;
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
        accountMismatch = false;
      }

      // When git remote owner ≠ active gh account, ask which to use before proceeding
      if (accountMismatch && isInteractive && ghLogin && gitOwner) {
        const accountChoice = await select({
          message: `gh account mismatch — git remote owner is ${pc.bold(gitOwner)} but you're logged in as ${pc.bold(ghLogin)}. Which account's journal?`,
          options: [
            {
              value: ghLogin,
              label: `${ghLogin} (current gh account)`,
              hint: `${ghLogin}/${ghLogin}.md`,
            },
            {
              value: gitOwner,
              label: `${gitOwner} (from git remote)`,
              hint: `run gh auth switch --user ${gitOwner} first`,
            },
            { value: '__manual__', label: 'Enter repo manually', hint: '' },
          ],
          initialValue: ghLogin,
        });
        if (isCancel(accountChoice)) {
          cancel('Setup cancelled.');
          process.exit(0);
        }
        if (accountChoice === ghLogin) {
          defaultRepo = `${ghLogin}/${ghLogin}.md`;
          accountMismatch = false;
        } else if (accountChoice === gitOwner) {
          defaultRepo = `${gitOwner}/${gitOwner}.md`;
          ui.info(`  Switch gh account first: ${pc.dim(`gh auth switch --user ${gitOwner}`)}\n`);
        } else {
          defaultRepo = '';
        }
      }

      ui.info(`  Journal repo ${pc.dim("(owner/name)")}`);
      if (sourceNote && !accountMismatch) ui.write(sourceNote);

      if (isInteractive) {
        const result = await text({
          message: 'Journal repo (owner/name) — this will remember your decisions and principles',
          placeholder: defaultRepo || `${ghLogin ?? 'you'}/${ghLogin ?? 'you'}.md`,
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
      const repoOwner = repo!.split('/')[0];
      const activeGhUser = ghUser();
      ui.write(`  ${pc.red("✗")} ${pc.white("Repository")} ${pc.bold(repo!)} ${pc.white("not found on GitHub.")}\n`);
      if (activeGhUser && repoOwner && repoOwner !== activeGhUser) {
        ui.info(`  Active gh account is ${pc.bold(activeGhUser)} but repo owner is ${pc.bold(repoOwner)}.\n`);
        ui.info(`  Switch account:  ${pc.dim(`gh auth switch --user ${repoOwner}`)}`);
        ui.info(`  Then re-run:     ${pc.dim(`dora init`)}\n`);
      } else {
        ui.info(`  Create it first:\n`);
        ui.info(`    ${pc.dim(`gh repo create ${repo} --private --description "Personal journal for agent decisions"`)}\n`);
      }
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
    let reconfigureAgent = false;

    if (existingAgent?.command) {
      ui.write(`  ${pc.bold(pc.white("Coding agent (already configured)"))}\n`);
      ui.write(`    Current: ${pc.dim(pc.gray(existingAgent.command))}  template: ${pc.dim(pc.gray(existingAgent.prompt_template || "(default)"))}  cwd_flag: ${pc.dim(pc.gray(existingAgent.cwd_flag || "(none)"))}\n`);

      if (isInteractive) {
        const change = await confirm({
          message: 'Reconfigure / change the coding agent for on-the-fly enrichment?',
          initialValue: false,
        });
        if (isCancel(change)) {
          cancel('Setup cancelled.');
          process.exit(0);
        }
        reconfigureAgent = !!change;
      }

      if (!reconfigureAgent) {
        ui.dim("  Keeping existing agent config. You can re-run dora init later to change it.\n");
        const cfg = (await readConfig()) || { journal: { repo: effectiveRepo, projects: {} } };
        if (existingAgent) cfg.agent = existingAgent;
        await writeConfig(cfg);
        // continue to Step 3 — the Evaluation setup (with the new direct API key + base URL option) now always runs
      } else {
        ui.blank();
      }
    } else {
      ui.write(`\n  ${pc.bold(pc.white("Step 2: Coding agent integration"))}\n`);
      if (isInteractive) {
        note('Configure the agent that will help you capture and enrich decisions/principles as you scale AI context through skills and plugins.');
      } else {
        ui.info(`  Configure the agent that will help you capture and enrich decisions/principles as you scale AI context through skills and plugins.\n`);
      }
      reconfigureAgent = true;
    }

    // Align presets with getDefaultPromptTemplate (single source of truth with agent-invoke)
    const agentPresets = [
      { name: "claude", template: getDefaultPromptTemplate("claude"), cwd_flag: "" },
      { name: "grok", template: getDefaultPromptTemplate("grok"), cwd_flag: "--cwd" },
      { name: "cursor", template: getDefaultPromptTemplate("cursor"), cwd_flag: "" },
    ] as const;

    let agentCmd = "grok";
    let template = getDefaultPromptTemplate("grok");
    let cwdFlag = "--cwd";

    if (reconfigureAgent) {
      let detected = "";
      for (const c of agentPresets) {
        let probe = spawnSync(["command", "-v", c.name], { stdout: "pipe", stderr: "pipe" });
        if (probe.exitCode !== 0) {
          probe = spawnSync(["which", c.name], { stdout: "pipe", stderr: "pipe" });
        }
        if (probe.exitCode === 0) {
          detected = c.name;
          break;
        }
      }

      agentCmd = detected || "grok";
      const preset = agentPresets.find((c) => c.name === agentCmd);
      template = preset?.template ?? getDefaultPromptTemplate(agentCmd);
      cwdFlag = preset?.cwd_flag ?? (agentCmd === "grok" ? "--cwd" : "");

      if (isInteractive) {
        ui.write(`  Detected / default agent command: ${pc.dim(pc.gray(agentCmd))}`);

        const agentOptions = [
          ...agentPresets.map((c) => ({
            value: c.name,
            label: `${c.name}${detected === c.name ? ' (detected)' : ''}`,
          })),
          { value: 'custom', label: 'Custom command' },
        ];

        const agentChoice = await select({
          message: 'Agent command — the one you use for coding (doraval will use it to help remember decisions)',
          options: agentOptions,
          initialValue: detected || 'grok',
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

        const chosen = agentPresets.find((c) => c.name === agentCmd);
        template = chosen?.template ?? getDefaultPromptTemplate(agentCmd);
        cwdFlag = chosen?.cwd_flag ?? (agentCmd.includes("grok") ? "--cwd" : "");

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
    }

    // ── Eval setup ──────────────────────────────────────────────────────────────
    ui.write(`\n  ${pc.bold("Step 3: Evaluation setup")}\n`);

    if (isInteractive) {
      note('Choose an LLM vendor so doraval can check that agents follow your decisions and principles while scaling AI context. Faster and cheaper than spawning your full coding agent.');
    } else {
      ui.info(`  Set up evaluation so doraval can check adherence while you scale AI context.\n`);
    }

    // Detect already-set env keys to pre-select provider and skip key prompt
    const detectedEnv = detectEnvProvider();
    if (detectedEnv) {
      ui.success(`${detectedEnv.provider.displayName} key detected (${detectedEnv.key}) — direct LLM evals available. Prefer env vars over storing keys in config.yml.`);
    }

    let evalProviderName = detectedEnv?.provider.name ?? '';
    let evalModelAnswer = '';
    let directApiKey = '';
    let directBaseUrl = '';

    if (isInteractive) {
      // Provider picker
      const providerOptions = [
        ...PROVIDERS.filter((p) => p.name !== 'custom').map((p) => ({
          value: p.name,
          label: `${p.displayName}${detectedEnv?.provider.name === p.name ? ' (key detected)' : ''}`,
          hint: p.defaultModels.slice(0, 2).join(', '),
        })),
        { value: 'custom', label: 'Custom (OpenAI-compatible)', hint: 'any base URL' },
        { value: 'skip', label: 'Skip — use coding agent as fallback', hint: '' },
      ];

      const providerChoice = await select({
        message: 'Which LLM vendor for eval?',
        options: providerOptions,
        initialValue: detectedEnv?.provider.name ?? 'skip',
      });
      if (isCancel(providerChoice)) {
        cancel('Setup cancelled.');
        process.exit(0);
      }

      if (providerChoice !== 'skip') {
        evalProviderName = providerChoice as string;
        const chosenProvider = PROVIDERS.find((p) => p.name === evalProviderName)!;
        const isCustom = evalProviderName === 'custom';

        // Base URL for custom provider
        if (isCustom) {
          const base = await text({
            message: 'Base URL for your OpenAI-compatible API',
            placeholder: 'https://your-api.example.com/v1',
            validate: (v) => (!v?.trim() ? 'Base URL is required for custom provider' : undefined),
          });
          if (isCancel(base)) {
            cancel('Setup cancelled.');
            process.exit(0);
          }
          directBaseUrl = (base as string).trim();
        } else {
          directBaseUrl = chosenProvider.baseUrl;
        }

        // API key — skip prompt if already in env
        const alreadyHasKey = [chosenProvider.envKey, ...chosenProvider.altEnvKeys].some(
          (k) => !!process.env[k]
        );

        if (!alreadyHasKey) {
          const envHint = chosenProvider.requiresApiKey
            ? ` Prefer setting ${chosenProvider.envKey} in your environment instead.`
            : '';
          const key = await password({
            message: `${chosenProvider.displayName} API key (stored in ~/.doraval/config.yml).${envHint}`,
          });
          if (isCancel(key)) {
            cancel('Setup cancelled.');
            process.exit(0);
          }
          directApiKey = typeof key === 'string' ? key.trim() : '';
        } else {
          ui.dim(`  Using ${detectedEnv!.key} from environment.`);
        }

        // Model — fetch live list from provider, fall back to defaults
        const resolvedKey = directApiKey ||
          [chosenProvider.envKey, ...chosenProvider.altEnvKeys]
            .map((k) => process.env[k])
            .find(Boolean) || '';
        const resolvedBase = directBaseUrl || chosenProvider.baseUrl;

        let liveModels: string[] = [];
        if (resolvedKey && resolvedBase) {
          const ms = spinner();
          ms.start('Fetching available models…');
          liveModels = await fetchProviderModels(resolvedBase, resolvedKey);
          if (liveModels.length > 0) {
            ms.stop(`${liveModels.length} models available`);
          } else {
            ms.stop('Could not fetch model list — showing defaults');
          }
        }

        // Bubble provider defaults to top; dedupe
        const defaults = chosenProvider.defaultModels;
        const extra = liveModels.filter((m) => !defaults.includes(m));
        const allModels = [...defaults, ...extra].slice(0, 20);

        if (allModels.length > 0) {
          const modelChoice = await select({
            message: 'Which model?',
            options: [
              ...allModels.map((m, i) => ({
                value: m,
                label: m,
                hint: i < defaults.length ? 'recommended' : '',
              })),
              { value: '__custom__', label: 'Enter a different model ID', hint: '' },
            ],
            initialValue: allModels[0],
          });
          if (isCancel(modelChoice)) {
            cancel('Setup cancelled.');
            process.exit(0);
          }
          if (modelChoice === '__custom__') {
            const custom = await text({
              message: 'Model ID',
              placeholder: allModels[0] ?? 'gpt-4o-mini',
            });
            if (isCancel(custom)) {
              cancel('Setup cancelled.');
              process.exit(0);
            }
            evalModelAnswer = (custom as string).trim() || (allModels[0] ?? 'gpt-4o-mini');
          } else {
            evalModelAnswer = modelChoice as string;
          }
        } else {
          // No key yet or fetch failed with no defaults either — free text
          const modelResult = await text({
            message: 'Model ID',
            placeholder: 'gpt-4o-mini',
          });
          if (isCancel(modelResult)) {
            cancel('Setup cancelled.');
            process.exit(0);
          }
          evalModelAnswer = (modelResult as string).trim() || 'gpt-4o-mini';
        }
      }
    }

    // Store eval config (merge with existing)
    if (evalProviderName && evalProviderName !== 'skip') {
      const existingCfg = await readConfig();
      const currentEval: Partial<EvalConfig> = existingCfg?.eval ?? {};
      const newEval: Partial<EvalConfig> = {
        ...currentEval,
        max_tool_calls: currentEval.max_tool_calls ?? 200,
        save_history: currentEval.save_history !== false,
        provider: evalProviderName,
      };
      if (evalModelAnswer) newEval.model = evalModelAnswer;
      if (directApiKey) newEval.api_key = directApiKey;
      if (directBaseUrl && evalProviderName !== 'custom') {
        // Only persist base_url for custom; known providers resolve it from registry
      } else if (directBaseUrl) {
        newEval.base_url = directBaseUrl;
      }

      const cfgToWrite: JournalConfig = existingCfg || { journal: { repo: effectiveRepo, projects: {} } };
      cfgToWrite.eval = newEval;
      await writeConfig(cfgToWrite);

      const chosenProvider = PROVIDERS.find((p) => p.name === evalProviderName);
      let successMsg = `Eval configured — ${chosenProvider?.displayName ?? evalProviderName}`;
      if (evalModelAnswer) successMsg += ` / ${evalModelAnswer}`;
      if (directApiKey) successMsg += ' + key saved (prefer env vars long-term)';
      ui.success(successMsg);
    } else if (!evalProviderName || evalProviderName === 'skip') {
      ui.info("  Skipped. Eval will use your coding agent as fallback, or set eval.provider + eval.model later.");
    }

    if (isInteractive) {
      outro('Setup complete. Your journal will now remember decisions and principles as you scale AI context.');
    } else {
      ui.info(`  Next: ${pc.dim(pc.gray("dora journal add \"..\""))} to record decisions while scaling context.\n`);
    }

    process.exit(0);
  },
});
