import { defineCommand } from "citty";
import { readdirSync, existsSync } from "fs";
import { join } from "path";
import { spawnSync } from "bun";
import pc from "picocolors";
import {
  readConfig,
  resolveProjectName,
  getPendingProjectDir,
  getJournalsDir,
  ensureDoravalDirs,
  sanitizeProjectName,
} from "../../../core/journal-config.js";
import {
  ensureGhCliOrExit,
  getRemoteJournalFileMeta,
  refreshLocalJournalFile,
} from "../../../core/journal-remote.js";

/**
 * Update or create a file on GitHub.
 * Uses the Contents API.
 */
function updateGitHubFile(
  repo: string,
  path: string,
  content: string,
  message: string,
  sha?: string
): void {
  const payload = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    ...(sha ? { sha } : {}),
  };

  const args = [
    "gh", "api",
    "--method", "PUT",
    "-H", "Accept: application/vnd.github+json",
    `repos/${repo}/contents/${path}`,
    "-f", `message=${payload.message}`,
    "-f", `content=${payload.content}`,
  ];

  if (sha) {
    args.push("-f", `sha=${sha}`);
  }

  const result = spawnSync(args, {
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    console.error(pc.red(`Failed to update ${path} on ${repo}:`));
    console.error(result.stderr.toString());
    process.exit(1);
  }
}

export default defineCommand({
  meta: {
    name: "sync",
    description: "Push pending journal entries to your remote GitHub journal repo",
  },
  args: {
    project: {
      type: "string",
      alias: "p",
      description: "Project to sync (defaults to current directory mapping)",
    },
    message: {
      type: "string",
      alias: "m",
      description: "Custom commit message for the sync",
    },
    verbose: {
      type: "boolean",
      alias: "v",
      description: "Show detailed diagnostics",
      default: false,
    },
  },

  async run({ args }) {
    const config = await readConfig();

    let project = args.project as string | undefined;
    if (!project) {
      project = resolveProjectName(config) ?? undefined;
    }

    if (project) {
      project = sanitizeProjectName(project);
    }

    if (!project) {
      console.error(
        `${pc.yellow("⚠")} No project mapping found.\n\n` +
          `Run ${pc.dim("dora init")} (or ${pc.dim("doraval journal init")}) first, or pass ${pc.dim("--project <name>")}.`
      );
      process.exit(1);
    }

    if (!config?.journal.repo) {
      console.error(`${pc.red("✗")} No journal repo configured. Run ${pc.dim("dora init")} (or ${pc.dim("doraval journal init")}) first.`);
      process.exit(1);
    }

    ensureGhCliOrExit();

    const journalRepo = config.journal.repo;
    const pendingDir = getPendingProjectDir(project);

    console.error(`\n  ${pc.bold(pc.white("dora journal sync"))} — ${pc.white(project)}\n`);
    console.error(`  Journal repo: ${pc.dim(pc.gray(journalRepo))}`);

    // ── Always pull latest into local cache first ──────────────────
    // This ensures `list`, future `check`, and principle drift see up-to-date entries,
    // and that the merge base we read below is the absolute latest from the remote.
    ensureDoravalDirs();
    const journalsDir = getJournalsDir();
    const remoteProjectPath = `projects/${project}.md`;
    const localProjectPath = join(journalsDir, `${project}.md`);

    console.error(`  ${pc.dim(pc.gray("Refreshing local cache from remote..."))}`);

    const gotGlobal = await refreshLocalJournalFile(journalRepo, "global.md", join(journalsDir, "global.md"));
    if (gotGlobal) {
      console.error(`  ${pc.dim(pc.gray("✓ global.md"))}`);
    }

    const gotProjectCache = await refreshLocalJournalFile(journalRepo, remoteProjectPath, localProjectPath);
    if (gotProjectCache) {
      console.error(`  ${pc.dim(pc.gray(`✓ ${remoteProjectPath}`))}`);
    }

    const pendingFiles = existsSync(pendingDir)
      ? readdirSync(pendingDir)
          .filter((f) => f.endsWith(".md") && f !== ".gitkeep")
          .sort()
      : [];

    if (pendingFiles.length === 0) {
      console.error(`\n  ${pc.yellow("⚠")} No pending entries. Local cache is now up to date.\n`);
      process.exit(0);
    }

    console.error(`  Found ${pendingFiles.length} pending entr${pendingFiles.length === 1 ? "y" : "ies"}\n`);

    // 1. Read current remote file (or start fresh)
    // Note: we already refreshed the local cache above; this re-reads the authoritative
    // remote (with sha) so the append + conditional PUT is safe.
    const remotePath = `projects/${project}.md`;
    const currentFile = getRemoteJournalFileMeta(journalRepo, remotePath);

    let existingContent = "";
    let currentSha: string | undefined;

    if (currentFile) {
      existingContent = Buffer.from(currentFile.content, "base64").toString("utf8");
      currentSha = currentFile.sha;
      if (args.verbose) console.error(`  ${pc.dim(pc.gray("Found existing remote file (sha: " + currentSha.slice(0, 7) + "...)"))}`);
    } else {
      if (args.verbose) console.error(`  ${pc.dim(pc.gray("No existing file on remote — will create it"))}`);
    }

    // 2. Collect all pending content
    let newEntries = "";
    for (const file of pendingFiles) {
      const fullPath = join(pendingDir, file);
      const entryContent = await Bun.file(fullPath).text();
      newEntries += "\n" + entryContent.trim() + "\n";
    }

    // 3. Build new file content
    let newContent: string;
    if (existingContent.trim().length === 0) {
      // Brand new file
      newContent =
        `# ${project} Journal\n\n` +
        `Project-specific decisions for **${project}**.\n\n` +
        newEntries.trim();
    } else {
      newContent = existingContent.trimEnd() + "\n" + newEntries;
    }

    // 4. Push to GitHub
    const commitMessage =
      (args.message as string) ||
      `journal: add ${pendingFiles.length} entr${pendingFiles.length === 1 ? "y" : "ies"} for ${project}`;

    if (args.verbose) console.error(`\n  ${pc.dim(pc.gray("Pushing to remote..."))}`);

    try {
      updateGitHubFile(journalRepo, remotePath, newContent, commitMessage, currentSha);
      console.error(`  ${pc.green("✓")} ${pc.white("Successfully pushed to")} ${pc.white(remotePath)}`);
    } catch (err) {
      console.error(`${pc.red("✗")} ${pc.white("Failed to push to GitHub.")}`);
      process.exit(1);
    }

    // 5. Clear pending directory
    for (const file of pendingFiles) {
      const fullPath = join(pendingDir, file);
      try {
        await Bun.file(fullPath).unlink();
      } catch {}
    }
    console.error(`  ${pc.green("✓")} ${pc.white("Cleared local pending entries")}`);

    // 6. Re-fetch the updated file into local journals cache (best effort)
    // We already did a pre-sync refresh; this gets the exact post-push state.
    try {
      const wrote = await refreshLocalJournalFile(journalRepo, remotePath, localProjectPath);
      if (wrote) {
        if (args.verbose) console.error(`  ${pc.green("✓")} ${pc.white("Re-fetched")} ${pc.white(project)}.md ${pc.white("into local cache")}`);
      }
    } catch {
      console.error(`  ${pc.yellow("⚠")} Could not re-fetch updated file (you can run sync again later)`);
    }

    console.error(
      `\n  ${pc.green("Done!")} ${pc.white(pendingFiles.length + " entr" + (pendingFiles.length === 1 ? "y" : "ies") + " published.")}\n`
    );

    process.exit(0);
  },
});
