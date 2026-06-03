import { defineCommand } from "citty";
import { basename, join } from "path";
import { spawnSync } from "bun";
import pc from "picocolors";
import {
  readConfig,
  writeConfig,
  ensureDoravalDirs,
  getJournalsDir,
  sanitizeProjectName,
  type JournalConfig,
} from "../../core/journal-config.js";
import {
  ensureGhCliOrExit,
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
    console.error(
      `\n  ${pc.bold("dora init")} — Set up doraval, your journal, and the coding agent dora should use on the fly\n`
    );

    ensureGhCliOrExit();

    // 1. Journal registration (same smart logic as `journal init`, but friendlier)
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
        console.error(`  ${pc.yellow("⚠")} Not logged in to GitHub. Run ${pc.dim("gh auth login")} first.\n`);
        process.exit(1);
      }

      const existingConfig = await readConfig();
      if (existingConfig?.journal.repo) {
        defaultRepo = existingConfig.journal.repo;
        sourceNote = `  ${pc.dim("(from your previous journal setup)")}\n`;
      }

      console.error(`  Journal repo ${pc.dim("(owner/name)")}`);
      if (sourceNote) console.error(sourceNote);
      repo = prompt("  >", defaultRepo);
    }

    let project = (args.project as string | undefined) || process.env.DORAVAL_PROJECT;
    if (!project) {
      const defaultProject = basename(process.cwd());
      project = prompt("  Project name", defaultProject);
    }
    project = sanitizeProjectName(project);

    if (!repoExists(repo!)) {
      console.error(`  ${pc.red("✗")} Repository ${pc.bold(repo!)} not found on GitHub.\n`);
      console.error(`  Create it first:\n`);
      console.error(`    ${pc.dim(`gh repo create ${repo} --private --description "Personal journal for agent decisions"`)}\n`);
      process.exit(1);
    }

    const existing = await readConfig();
    const alreadyRegistered = existing?.journal.projects[project];
    const isRefresh = alreadyRegistered && args.refresh;

    if (alreadyRegistered && !isRefresh) {
      console.error(`  ${pc.yellow("⚠")} Project ${pc.bold(project)} is already registered.\n`);
      console.error(`  Repo:   ${existing.journal.repo}\n`);
      console.error(`  To refresh journal files, use ${pc.dim("dora journal update")} (or ${pc.dim("dora init --refresh")}).\n`);
      // We still perform the (idempotent) journal fetch below for safety, then always proceed to (re)configure the agent.
    }

    // Perform the journal fetch / registration
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

    console.error(`  ${pc.dim("Fetching journal files from")} ${effectiveRepo}${pc.dim("...")}\n`);

    const globalDest = join(journalsDir, "global.md");
    const wroteGlobal = await refreshLocalJournalFile(effectiveRepo, "global.md", globalDest);
    if (wroteGlobal) {
      console.error(`  ${pc.green("✓")} global.md`);
    } else {
      console.error(`  ${pc.dim("·")} global.md ${pc.dim("(not found — will be created on first sync)")}`);
      await Bun.write(globalDest, "# Global Journal\n\nCross-project principles.\n");
    }

    const wroteProject = await refreshLocalJournalFile(effectiveRepo, remotePath, localPath);
    if (wroteProject) {
      console.error(`  ${pc.green("✓")} ${remotePath}`);
    } else {
      console.error(`  ${pc.dim("·")} ${remotePath} ${pc.dim("(not found — will be created on first sync)")}`);
      await Bun.write(localPath, `# ${project} Journal\n\nProject-specific decisions.\n`);
    }

    await writeConfig(config);

    console.error(`\n  ${pc.green("✓")} Journal ready for project ${pc.bold(project)}.\n`);

    // 2. Agent configuration (the new part the user asked for)
    const existingAgent = (await readConfig())?.agent;
    if (existingAgent?.command) {
      console.error(`  ${pc.bold("Coding agent (already configured)")}\n`);
      console.error(`    Current: ${pc.dim(existingAgent.command)}  template: ${pc.dim(existingAgent.prompt_template || "(default)")}\n`);
      const change = prompt("  Reconfigure / change the coding agent for on-the-fly enrichment? (y/N)", "n");
      if (!/^y/i.test(String(change))) {
        console.error(`  ${pc.dim("Keeping existing agent config. You can re-run dora init later to change it.")}\n`);
        // Force a write with current serialize to ensure agent is persisted cleanly with latest format
        const cfg = (await readConfig()) || { journal: { repo: effectiveRepo, projects: {} } };
        if (existingAgent) cfg.agent = existingAgent;
        await writeConfig(cfg);
        console.error(`  ${pc.green("All set!")} Try: ${pc.dim("dora journal add \"short decision\"")} (it will use the agent when input is minimal).\n`);
        process.exit(0);
        return;
      }
      console.error(""); // spacer before the questions
    } else {
      console.error(`  ${pc.bold("Coding agent for on-the-fly use in journal add")}\n`);
      console.error(`  dora can use your existing coding agent (Claude Code, Cursor, etc.) behind the scenes\n`);
      console.error(`  when you run ${pc.dim("dora journal add \"short decision\"")} so you get rich pushback/tags/rationale (tags for decisions or notes)\n`);
      console.error(`  with almost no extra typing.\n`);
    }

    // Simple detection + prompt for the invocation template
    const common = [
      { name: "claude", template: '-p "{{prompt}}" --output-format json' },
      { name: "cursor", template: '' }, // users can fill
    ];

    let detected = "";
    for (const c of common) {
      // Prefer portable `command -v`; fall back to `which`
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
    console.error(`  Detected / default agent command: ${pc.dim(agentCmd)}`);
    agentCmd = prompt("  Agent command (the binary you run for prompts)", agentCmd);

    let template = detected ? (common.find(c => c.name === detected)?.template || '-p "{{prompt}}" --output-format json') : '-p "{{prompt}}" --output-format json';
    console.error(`  Prompt template (use {{prompt}} placeholder):`);
    template = prompt("  ", template);

    // Store in config
    const finalConfig: JournalConfig = (await readConfig()) || { journal: { repo: effectiveRepo, projects: {} } };
    finalConfig.agent = {
      command: agentCmd,
      prompt_template: template,
    };
    await writeConfig(finalConfig);

    console.error(`\n  ${pc.green("✓")} Agent configured. Future ${pc.dim("dora journal add \"...\"")} calls will try to use it on the fly (when input is minimal).\n`);
    console.error(`  You can re-run ${pc.dim("dora init")} anytime to change the agent.\n`);
    console.error(`  Example one-liner that will now feel magical:\n`);
    console.error(`    ${pc.dim("dora journal add \"We decided to use the new cache command name\"")}\n`);

    console.error(`  ${pc.green("All set!")} Next steps: ${pc.dim("dora journal list")}, ${pc.dim("dora journal add \"...\"")}, or ${pc.dim("dora journal update")}.\n`);

    process.exit(0);
  },
});
