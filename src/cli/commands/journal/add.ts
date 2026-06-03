import { defineCommand } from "citty";
import { existsSync } from "fs";
import { join } from "path";
import { spawnSync } from "bun";
import pc from "picocolors";
import {
  readConfig,
  resolveProjectName,
  getPendingProjectDir,
  ensureDoravalDirs,
  sanitizeProjectName,
} from "../../../core/journal-config.js";
import { validateEntry } from "../../../core/journal-validate.js";
import type { JournalEntry } from "../../../core/journal-parse.js";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";
}

async function openEditor(initialContent: string): Promise<string> {
  const editor = process.env.EDITOR || process.env.VISUAL || "vi";
  const tmpDir = process.env.TMPDIR || "/tmp";
  const tmpFile = join(tmpDir, `doraval-journal-${Date.now()}.md`);

  // Write initial content (the YAML skeleton + title)
  await Bun.write(tmpFile, initialContent);

  const result = spawnSync([editor, tmpFile], {
    stdio: ["inherit", "inherit", "inherit"],
  });

  if (result.exitCode !== 0) {
    console.error(pc.red("Editor exited with error. Aborting."));
    process.exit(1);
  }

  const content = await Bun.file(tmpFile).text();

  // Best effort cleanup
  try {
    await Bun.file(tmpFile).unlink();
  } catch {}

  return content;
}

export default defineCommand({
  meta: {
    name: "add",
    description: "Propose a new decision / principle for the journal",
  },
  args: {
    title: {
      type: "positional",
      description: "Title of the decision or principle",
      required: true,
    },
    pushback: {
      type: "number",
      alias: "b",
      description: "Pushback intensity (1-10)",
      required: true,
    },
    scope: {
      type: "string",
      alias: "s",
      description: "Comma-separated scope tags (e.g. naming,cli,architecture)",
      required: true,
    },
    author: {
      type: "string",
      alias: "a",
      description: 'Author (default: "human", or "agent:grok", etc.)',
      default: "human",
    },
    status: {
      type: "string",
      description: "Status (active | superseded | retired)",
      default: "active",
    },
    rationale: {
      type: "string",
      alias: "r",
      description: "Rationale / explanation. If omitted, opens $EDITOR.",
    },
    project: {
      type: "string",
      alias: "p",
      description: "Project name (defaults to directory mapping)",
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

    const title = (args.title as string).trim();
    const pushback = Number(args.pushback);
    const scope = (args.scope as string)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const author = args.author as string;
    const status = args.status as JournalEntry["status"];

    const entry: Partial<JournalEntry> = {
      title,
      pushback,
      scope,
      author,
      date: new Date().toISOString().split("T")[0],
      status,
    };

    // Validate early (before asking for rationale)
    const validation = validateEntry(entry);
    if (!validation.valid) {
      console.error(`${pc.red("✗")} Invalid entry:\n`);
      for (const err of validation.errors) {
        console.error(`  ${pc.red("•")} ${err}`);
      }
      process.exit(1);
    }
    for (const warn of validation.warnings) {
      console.error(`${pc.yellow("⚠")} ${warn}`);
    }

    // Get rationale
    let rationale = (args.rationale as string | undefined)?.trim();

    if (!rationale) {
      const skeleton = `# ${title}

\`\`\`yaml
pushback: ${pushback}
scope: [${scope.join(", ")}]
author: ${author}
date: ${entry.date}
status: ${status}
\`\`\`

# Write your rationale / explanation below this line.
# You can use multiple paragraphs, lists, code blocks, etc.
`;

      if (process.stdout.isTTY) {
        console.error(`\n  Opening editor for rationale... (save & exit when done)\n`);
        const full = await openEditor(skeleton);
        // Strip the skeleton we provided and take only the user's additions
        rationale = full.replace(skeleton, "").trim();
      } else {
        console.error(
          `${pc.red("✗")} --rationale is required when not running interactively.\n` +
            `You can also pipe rationale via stdin in a future version.`
        );
        process.exit(1);
      }
    }

    if (!rationale) {
      console.error(`${pc.red("✗")} Rationale cannot be empty.`);
      process.exit(1);
    }

    // Build final file content
    const content = `## ${title}

\`\`\`yaml
pushback: ${pushback}
scope: [${scope.join(", ")}]
author: ${author}
date: ${entry.date}
status: ${status}
\`\`\`

${rationale}
`;

    // Write to pending
    ensureDoravalDirs();
    const pendingDir = getPendingProjectDir(project);
    if (!existsSync(pendingDir)) {
      Bun.write(join(pendingDir, ".gitkeep"), ""); // ensure dir exists
    }

    const date = entry.date!;
    const slug = slugify(title);
    const filename = `${date}-${slug}.md`;
    const filePath = join(pendingDir, filename);

    await Bun.write(filePath, content);

    console.error(`\n  ${pc.green("✓")} Entry staged successfully.\n`);
    console.error(`  Project:  ${pc.bold(project)}`);
    console.error(`  Title:    ${pc.bold(title)}`);
    console.error(`  Pushback: ${pushback}`);
    console.error(`  Scope:    ${scope.join(", ")}`);
    console.error(`  File:     ${pc.dim(filePath)}\n`);
    console.error(
      `  Run ${pc.dim("doraval journal sync")} to publish it to your journal repo.\n`
    );
  },
});
