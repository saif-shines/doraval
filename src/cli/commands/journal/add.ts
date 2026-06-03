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

/**
 * Pure helper: turn a template string containing {{prompt}} and a (possibly multiline) prompt
 * into a proper argv array for spawn, keeping the prompt text as a *single* argument.
 *
 * Example template: '-p "{{prompt}}" --output-format json'
 * The quotes in the template are only for shell users; we strip them here.
 */
export function buildAgentArgv(template: string, promptText: string): string[] {
  const marker = '__DORA_PROMPT__';
  const substituted = template.replace('{{prompt}}', marker);
  const rawParts = substituted.split(/\s+/).filter(Boolean);

  return rawParts.map(part => {
    // First strip any shell-style quotes that were around the {{prompt}} in the template
    let cleaned = part;
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) cleaned = cleaned.slice(1, -1);
    if (cleaned.startsWith("'") && cleaned.endsWith("'")) cleaned = cleaned.slice(1, -1);

    if (cleaned === marker) {
      return promptText; // emit the full (multiline) prompt as a single argv element
    }
    return cleaned;
  });
}

/**
 * Invoke the pre-configured coding agent (from `dora init`) with a scaffold prompt
 * and return the parsed JSON (or null on any failure).
 * This is the "on the fly" enrichment for minimal `journal add "title"`.
 * Tags (not scope) are used for categorization of both decisions and general notes.
 */
async function invokeConfiguredAgentForEntry(decisionText: string, agentCfg: any): Promise<Partial<JournalEntry> | null> {
  if (!agentCfg || !agentCfg.command) return null;

  const scaffold = `Raw user capture (a decision, observation, or useful note that just happened): "${decisionText}"

Turn this into a clean journal entry. Infer the core decision or note even if the input is phrased as a todo or reminder. Be professional and concise.

**CRITICAL INSTRUCTIONS (follow exactly):**
- Output *ONLY* a single valid JSON object. Nothing before it, nothing after it, no markdown fences, no explanations, no extra text.
- The JSON must have exactly these keys (use the suggested values as starting point but improve them):
{
  "title": "Short, scannable, professional title (past tense or present perfect, max ~80 chars)",
  "pushback": 4,
  "tags": ["cli", "ux"],
  "rationale": "2-5 sentences explaining context and implications (or the note content).",
  "author": "agent:claude-code"
}

If you cannot produce exactly this, output the JSON with the best you can and set "author" to "agent:claude-code" anyway.`;

  // Template example stored by dora init: '-p "{{prompt}}" --output-format json'
  const template = agentCfg.prompt_template || '-p "{{prompt}}" --output-format json';
  const extraArgs = buildAgentArgv(template, scaffold);

  // Print a short version of what we are about to run (the full prompt is huge)
  const shortTemplate = (agentCfg.prompt_template || '-p "{{prompt}}" --output-format json').slice(0, 80);
  console.error(`  ${pc.dim(`→ ${agentCfg.command} ${shortTemplate}...`)}`);

  try {
    const result = spawnSync([agentCfg.command, ...extraArgs], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = result.stdout.toString().trim();
    const stderr = result.stderr.toString().trim();

    if (result.exitCode !== 0) {
      console.error(`${pc.yellow("⚠")} Configured agent (${agentCfg.command}) exited with code ${result.exitCode}. Falling back to defaults.`);
      if (stderr) console.error(`  ${pc.dim("stderr from agent:")}\n${stderr.slice(0, 800)}`);
      if (stdout) console.error(`  ${pc.dim("stdout from agent:")}\n${stdout.slice(0, 400)}`);
      return null;
    }

    // Smart extraction:
    // - Some "claude" binaries (full agent runners) wrap everything in a metadata object:
    //   { type: "result", result: "{\"title\":..., \"rationale\":...}", ... }
    // - The model itself may also return extra text. We look for the JSON that actually
    //   contains our expected fields.
    let candidates: any[] = [];

    // Try the whole stdout first
    let jsonMatch = stdout.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        candidates.push(JSON.parse(jsonMatch[0]));
      } catch {}
    }

    // Also try every top-level JSON-looking blob (in case there are multiple)
    const allMatches = stdout.match(/\{[\s\S]*?\}(?=\s*(?:\{|$))/g) || [];
    for (const m of allMatches) {
      try {
        const p = JSON.parse(m);
        candidates.push(p);
      } catch {}
    }

    let parsed: any = null;

    // Prefer any object that looks like our entry (has title or rationale at top level)
    for (const c of candidates) {
      if (c && typeof c === "object" && (c.title || c.rationale)) {
        parsed = c;
        break;
      }
    }

    // Special case for common agent-runner wrapper: { ..., result: "JSON string or object" }
    if (!parsed) {
      for (const c of candidates) {
        if (c && typeof c === "object" && c.result) {
          let inner = c.result;
          if (typeof inner === "string") {
            try { inner = JSON.parse(inner); } catch {}
          }
          if (inner && typeof inner === "object" && (inner.title || inner.rationale)) {
            parsed = inner;
            break;
          }
        }
      }
    }

    if (!parsed) {
      // Fallback to the first parsed blob if nothing better was found
      parsed = candidates[0] || null;
    }

    if (!parsed || typeof parsed !== "object") {
      console.error(`${pc.yellow("⚠")} Agent produced output but no usable JSON object was found. Falling back.`);
      console.error(`  ${pc.dim("stdout (first 700 chars):")}\n${stdout.slice(0, 700)}`);
      if (stderr) console.error(`  ${pc.dim("stderr:")}\n${stderr.slice(0, 500)}`);
      return null;
    }

    // Final shape check
    if (!parsed.title && !parsed.rationale) {
      console.error(`${pc.yellow("⚠")} Agent returned JSON, but it did not contain expected fields (title/rationale). Using defaults.`);
      console.error(`  ${pc.dim("parsed top-level keys:")} ${Object.keys(parsed).join(", ")}`);
      console.error(`  ${pc.dim("raw stdout (truncated):")}\n${stdout.slice(0, 600)}`);
      return null;
    }

    return parsed;
  } catch (e) {
    console.error(`${pc.yellow("⚠")} Failed to invoke configured agent (${agentCfg.command}): ${(e as Error).message}. Using defaults.`);
    return null;
  }
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";
}

export default defineCommand({
  meta: {
    name: "add",
    description: "Propose a new decision, note or principle (pushback & tags optional; agent can enrich on the fly)",
  },
  args: {
    title: {
      type: "positional",
      description: "Title of the decision or principle (the only argument needed for the low-friction path; other fields use defaults or the configured agent)",
      required: false,
    },
    pushback: {
      type: "number",
      alias: "b",
      description: "Pushback intensity (1-10). Optional — defaults are applied (or supplied by --json / on-the-fly agent).",
      required: false,
    },
    tags: {
      type: "string",
      alias: "t",
      description: "Comma-separated tags (e.g. naming,cli,architecture). Optional — defaults are applied (or supplied by --json / on-the-fly agent). Renamed from --scope for broader use with notes too.",
      required: false,
    },
    // legacy alias for --tags (still parsed for backward compat in scripts)
    scope: {
      type: "string",
      description: "(deprecated) Use --tags instead",
      required: false,
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
      description: "Rationale / explanation (one line). For rich/multi-line or long markdown content use --raw-markdown <file-or-> (or --json for full structured entries).",
    },
    rawMarkdown: {
      type: "string",
      description: 'Path to a raw markdown file (or "-" for stdin) to use as the entry body after the YAML block. Accepts --raw-markdown or --rawMarkdown. Title can be positional or extracted from the first "# Heading". Bypasses agent. Great for long notes and rich docs.',
    },
    project: {
      type: "string",
      alias: "p",
      description: "Project name (defaults to directory mapping)",
    },
    json: {
      type: "string",
      alias: "j",
      description: 'Full entry as JSON (title, pushback, tags, rationale, ...). Use "-" to read from stdin. Highest precedence; bypasses other input methods. (JSON may still use "scope" for legacy compat.)',
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

    // ── 1. Highest precedence: --json (for agents / scripts / the internal on-the-fly path)
    let title: string | undefined;
    let pushback: number | undefined;
    let tags: string[] = [];
    let author = args.author as string || "human";
    let status = (args.status as JournalEntry["status"]) || "active";
    let rationale: string | undefined;
    let date = new Date().toISOString().split("T")[0];

    const jsonInput = args.json as string | undefined;
    if (jsonInput) {
      let rawJson = jsonInput;
      if (jsonInput === "-" || jsonInput === "") {
        // read from stdin
        const stdinText = await new Response(Bun.stdin.stream()).text();
        rawJson = stdinText.trim();
      }
      try {
        const parsed = JSON.parse(rawJson);
        title = parsed.title ? String(parsed.title).trim() : undefined;
        pushback = typeof parsed.pushback === "number" ? parsed.pushback : (parsed.pushback ? Number(parsed.pushback) : undefined);
        // Support both "tags" (preferred) and legacy "scope" in JSON input
        if (Array.isArray(parsed.tags)) {
          tags = parsed.tags.map((s: any) => String(s).trim()).filter(Boolean);
        } else if (typeof parsed.tags === "string") {
          tags = parsed.tags.split(",").map((s: string) => s.trim()).filter(Boolean);
        } else if (Array.isArray(parsed.scope)) {
          tags = parsed.scope.map((s: any) => String(s).trim()).filter(Boolean);
        } else if (typeof parsed.scope === "string") {
          tags = parsed.scope.split(",").map((s: string) => s.trim()).filter(Boolean);
        }
        rationale = parsed.rationale ? String(parsed.rationale).trim() : undefined;
        if (parsed.author) author = String(parsed.author);
        if (parsed.status) status = parsed.status as JournalEntry["status"];
        if (parsed.date) date = String(parsed.date);
      } catch (e) {
        console.error(`${pc.red("✗")} Failed to parse --json input: ${(e as Error).message}`);
        process.exit(1);
      }
    }

    // ── 1b. Raw markdown body (for long notes / rich content). Supports file path, "-" (stdin), or literal content.
    // Highest precedence for body after --json. Bypasses thin-input agent enrichment.
    let rawBody: string | undefined;
    const rawMdArg = args.rawMarkdown as string | undefined;
    if (rawMdArg && !jsonInput) {
      if (rawMdArg === "-" || rawMdArg === "") {
        rawBody = (await new Response(Bun.stdin.stream()).text()).trim();
      } else if (existsSync(rawMdArg)) {
        rawBody = (await Bun.file(rawMdArg).text()).trim();
      } else {
        // Treat the value itself as literal markdown content (supports direct paste / shell $'...' / heredoc)
        rawBody = rawMdArg.trim();
      }
    }

    // ── 2. Title resolution (positional first, then raw-markdown heading extraction)
    if (!title) {
      title = (args.title as string | undefined)?.trim() || "";
    }

    // Raw-markdown title extraction (before any "Untitled" default)
    if (!title && rawBody) {
      const headingMatch = rawBody.match(/^#+\s+(.+?)(?:\r?\n|$)/m);
      if (headingMatch) {
        title = headingMatch[1].trim();
        rawBody = rawBody.replace(/^#+\s+(.+?)(?:\r?\n|$)/m, "").trimStart();
      } else {
        console.error(`${pc.red("✗")} --raw-markdown provided without a TITLE and without a leading '# Heading' in the markdown.`);
        process.exit(1);
      }
    }

    if (!title) {
      title = "Untitled decision";
    }

    if (pushback === undefined) {
      const cliPb = args.pushback as number | undefined;
      pushback = (cliPb !== undefined) ? Number(cliPb) : 5; // relaxed default
    }
    if (tags.length === 0) {
      // support legacy --scope flag name for CLI backward compat
      let cliTagsStr = (args.tags as any) || (args.scope as any);
      if (cliTagsStr != null) {
        if (typeof cliTagsStr !== 'string') cliTagsStr = String(cliTagsStr);
        tags = cliTagsStr.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
      // else leave as [] (relaxed default)
    }

    // Small UX bias for raw-markdown "notes": low pushback + notes tag when user didn't supply metadata.
    if (rawBody !== undefined && !args.pushback && !args.tags && !args.scope) {
      if (tags.length === 0) tags = ["notes"];
      if (pushback === 5) pushback = 1;
    }

    if (rawBody !== undefined) {
      rationale = rawBody;
    } else if (!rationale) {
      const cliRat = (args.rationale as string | undefined)?.trim();
      rationale = cliRat || title; // relaxed default: seed from title
    }

    // On-the-fly agent enrichment (the magic the user asked for) -- do this BEFORE validation
    // so that "not supplied" warnings don't fire when the agent will provide rich values,
    // and so agent output gets validated.
    const cameFromExplicitJson = !!jsonInput;
    const isThinInput = !args.pushback && !args.tags && !args.scope && !args.rationale && !rawMdArg; // support legacy --scope in check; raw-markdown is explicit

    let agentCfg: any = null;
    let attemptedAgent = false;
    if (!cameFromExplicitJson && isThinInput) {
      const fullConfigForAgent = await readConfig();
      agentCfg = (fullConfigForAgent as any)?.agent;
      if (agentCfg) {
        attemptedAgent = true;
        console.error(`  ${pc.dim("(querying your configured coding agent...)")}`);
        const agentResult = await invokeConfiguredAgentForEntry(title, agentCfg);
        if (agentResult) {
          if (agentResult.title) title = String(agentResult.title).trim();
          if (typeof agentResult.pushback === "number") pushback = agentResult.pushback;
          if (Array.isArray(agentResult.tags)) {
            tags = agentResult.tags.map((s: any) => String(s).trim()).filter(Boolean);
          } else if (Array.isArray(agentResult.scope)) { // legacy support in agent JSON
            tags = agentResult.scope.map((s: any) => String(s).trim()).filter(Boolean);
          }
          if (agentResult.rationale) rationale = String(agentResult.rationale).trim();
          if (agentResult.author) author = String(agentResult.author);
          if (agentResult.status) status = agentResult.status as JournalEntry["status"];
          if (agentResult.date) date = String(agentResult.date);
          // The success summary below will prominently show the agent author + "(enriched...)" note.
        }
      }
    }

    const entry: Partial<JournalEntry> = {
      title,
      pushback,
      tags,
      author,
      date,
      status,
    };

    // Validate (now relaxed — pushback/tags missing or empty only produce warnings)
    const validation = validateEntry(entry);
    if (!validation.valid) {
      console.error(`${pc.red("✗")} Invalid entry:\n`);
      for (const err of validation.errors) {
        console.error(`  ${pc.red("•")} ${err}`);
      }
      process.exit(1);
    }
    for (const warn of validation.warnings) {
      if ((warn.includes("not supplied") || warn.includes("empty")) && attemptedAgent) {
        // We tried the agent; if it didn't supply the fields it's on the model, not the user. Keep quiet.
      } else if (warn.includes("not supplied") || warn.includes("empty")) {
        // Soft note for the intentional low-friction/minimal path (not alarming)
        console.error(`${pc.dim("·")} ${warn}`);
      } else {
        console.error(`${pc.yellow("⚠")} ${warn}`);
      }
    }

    // Rationale/body is already resolved above (no auto editor on the plain `add "title"` path).
    // For rich/multi-line/long markdown bodies, use --raw-markdown <file-or-> (preferred for long notes)
    // or --json (for full structured control). --rationale remains available for short one-liners.
    // Edit the pending file before sync is always an option for last-minute tweaks.
    if (!rationale) {
      // Should not happen because of the default above, but be defensive
      rationale = title;
    }

    // Build final file content (always clean, using the values we decided on)
    const content = `## ${title}

\`\`\`yaml
pushback: ${pushback}
tags: [${tags.join(", ")}]
author: ${author}
date: ${date}
status: ${status}
\`\`\`

${rationale}
`;

    // Write to pending (uses the `content` built above with the final values)
    ensureDoravalDirs();
    const pendingDir = getPendingProjectDir(project);
    if (!existsSync(pendingDir)) {
      await Bun.write(join(pendingDir, ".gitkeep"), ""); // ensure dir exists
    }

    const slug = slugify(title);
    const filename = `${date}-${slug}.md`;
    const filePath = join(pendingDir, filename);

    await Bun.write(filePath, content);

    console.error(`\n  ${pc.green("✓")} Entry staged successfully.\n`);
    console.error(`  Project:  ${pc.bold(project)}`);
    console.error(`  Title:    ${pc.bold(title)}`);
    console.error(`  Pushback: ${pushback}`);
    console.error(`  Tags:     ${tags.join(", ") || pc.dim("(none)")}`);
    const authorDisplay = author.startsWith("agent:") ? pc.cyan(author) : author;
    console.error(`  Author:   ${authorDisplay}`);
    if (author.startsWith("agent:")) {
      console.error(`            ${pc.dim("(enriched on the fly by your configured coding agent)")}`);
    }
    console.error(`  File:     ${pc.dim(filePath)}\n`);

    if (isThinInput && !author.startsWith("agent:")) {
      if (attemptedAgent) {
        console.error(
          `  ${pc.dim("Note:")} Your configured agent was called but did not return a usable enrichment this time (see warning above).\n` +
          `        The raw title + defaults were used. Edit the pending file or tweak the agent template with dora init.\n`
        );
      } else {
        console.error(
          `  ${pc.dim("Tip:")} run ${pc.dim("dora init")} to configure a coding agent (Claude, Cursor, etc.)\n` +
          `        so minimal adds like this get rich titles, tags, and rationales automatically.\n`
        );
      }
    }

    console.error(
      `  Run ${pc.dim("dora journal sync")} (or ${pc.dim("doraval journal sync")}) to publish it to your journal repo.\n`
    );

    process.exit(0);
  },
});
