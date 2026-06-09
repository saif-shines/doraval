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
    ui.heading("dora init — Set up doraval, your journal, and the coding agent dora should use on the fly");

    ensureGhCliOrExit();

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
    const wroteGlobal = await refreshLocalJournalFile(effectiveRepo, "global.md", globalDest);
    if (wroteGlobal) {
      ui.success("global.md");
    } else {
      ui.write(`  ${pc.dim("·")} global.md ${pc.dim("(not found — will be created on first sync)")}`);
      await Bun.write(globalDest, "# Global Journal\n\nCross-project principles.\n");
    }

    const wroteProject = await refreshLocalJournalFile(effectiveRepo, remotePath, localPath);
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
      ui.write(`  ${pc.bold(pc.white("Coding agent for journal add"))}\n`);
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
    ui.info(`  Next: ${pc.dim(pc.gray("dora journal add \"..\""))}, ${pc.dim(pc.gray("dora journal list"))}, or ${pc.dim(pc.gray("dora journal update"))}.\n`);

    process.exit(0);
  },
});
