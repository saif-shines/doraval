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

interface GitHubFile {
  sha: string;
  content: string; // base64
  encoding: string;
}

/**
 * Get file metadata + content from GitHub using gh CLI.
 * Returns null if the file does not exist (404).
 */
function getGitHubFile(repo: string, path: string): GitHubFile | null {
  const result = spawnSync(
    ["gh", "api", `repos/${repo}/contents/${path}`, "--jq", "{sha, content, encoding}"],
    { stdout: "pipe", stderr: "pipe" }
  );

  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString();
    if (stderr.includes("404") || stderr.includes("Not Found")) {
      return null;
    }
    console.error(pc.red(`Failed to fetch ${path} from ${repo}:`));
    console.error(stderr);
    process.exit(1);
  }

  try {
    return JSON.parse(result.stdout.toString()) as GitHubFile;
  } catch {
    console.error(pc.red(`Unexpected response when fetching ${path}`));
    process.exit(1);
  }
}

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
          `Run ${pc.dim("doraval journal init")} first, or pass ${pc.dim("--project <name>")}.`
      );
      process.exit(1);
    }

    if (!config?.journal.repo) {
      console.error(`${pc.red("✗")} No journal repo configured. Run ${pc.dim("doraval journal init")} first.`);
      process.exit(1);
    }

    const journalRepo = config.journal.repo;
    const pendingDir = getPendingProjectDir(project);

    if (!existsSync(pendingDir)) {
      console.error(`${pc.yellow("⚠")} No pending entries for project "${project}". Nothing to sync.`);
      process.exit(0);
    }

    const pendingFiles = readdirSync(pendingDir)
      .filter((f) => f.endsWith(".md") && f !== ".gitkeep")
      .sort();

    if (pendingFiles.length === 0) {
      console.error(`${pc.yellow("⚠")} No pending entries for project "${project}". Nothing to sync.`);
      process.exit(0);
    }

    console.error(`\n  ${pc.bold("doraval journal sync")} — ${project}\n`);
    console.error(`  Journal repo: ${pc.dim(journalRepo)}`);
    console.error(`  Found ${pendingFiles.length} pending entr${pendingFiles.length === 1 ? "y" : "ies"}\n`);

    // 1. Read current remote file (or start fresh)
    const remotePath = `projects/${project}.md`;
    const currentFile = getGitHubFile(journalRepo, remotePath);

    let existingContent = "";
    let currentSha: string | undefined;

    if (currentFile) {
      existingContent = Buffer.from(currentFile.content, "base64").toString("utf8");
      currentSha = currentFile.sha;
      console.error(`  ${pc.dim("Found existing remote file (sha: " + currentSha.slice(0, 7) + "...)")}`);
    } else {
      console.error(`  ${pc.dim("No existing file on remote — will create it")}`);
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

    console.error(`\n  ${pc.dim("Pushing to remote...")}`);

    try {
      updateGitHubFile(journalRepo, remotePath, newContent, commitMessage, currentSha);
      console.error(`  ${pc.green("✓")} Successfully pushed to ${remotePath}`);
    } catch (err) {
      console.error(`${pc.red("✗")} Failed to push to GitHub.`);
      process.exit(1);
    }

    // 5. Clear pending directory
    for (const file of pendingFiles) {
      const fullPath = join(pendingDir, file);
      try {
        await Bun.file(fullPath).unlink();
      } catch {}
    }
    console.error(`  ${pc.green("✓")} Cleared local pending entries`);

    // 6. Re-fetch the updated file into local journals cache (best effort)
    ensureDoravalDirs();
    const journalsDir = getJournalsDir();
    const localProjectPath = join(journalsDir, `${project}.md`);

    try {
      const updatedFile = getGitHubFile(journalRepo, remotePath);
      if (updatedFile) {
        const decoded = Buffer.from(updatedFile.content, "base64").toString("utf8");
        await Bun.write(localProjectPath, decoded);
        console.error(`  ${pc.green("✓")} Re-fetched ${project}.md into local cache`);
      }
    } catch {
      console.error(`  ${pc.yellow("⚠")} Could not re-fetch updated file (you can run sync again later)`);
    }

    console.error(
      `\n  ${pc.green("Done!")} ${pendingFiles.length} entr${pendingFiles.length === 1 ? "y" : "ies"} published.\n`
    );
  },
});
