#!/usr/bin/env bun
/**
 * Local web dashboard for doraval.
 * Run with `dora ui`.
 *
 * Design goals (Option 1):
 * - Fast local experience so you stop typing repetitive commands
 * - Reuses core journal + hook logic directly
 * - Clean: startup messages + UI chrome go to stderr. No data on stdout.
 * - Uses Bun.serve (see bun skill)
 */

import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import pc from "picocolors";

import { ui as cliUi } from "../out.js";
import {
  readConfig,
  resolveProjectName,
  getJournalsDir,
  getPendingProjectDir,
  getPendingDir,
  ensureDoravalDirs,
  sanitizeProjectName,
} from "../../core/journal-config.js";
import {
  parseJournalEntries,
  type JournalEntry,
} from "../../core/journal-parse.js";
import {
  generateJournalContext,
} from "./journal/context.js";

// Hook pure functions (exported from hook.ts)
import {
  hasHook,
  addHook,
  removeHook,
  getLocalHooksPath,
  getGlobalSettingsPath,
  readHookConfig,
} from "./journal/hook.js";

// --- Helpers (pure-ish, adapted from list + add for the dashboard) ---

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";
}

async function loadAllEntries(project: string | null) {
  const journalsDir = getJournalsDir();
  const entries: (JournalEntry & { _source?: string; _staged?: boolean })[] = [];

  // Global
  const globalPath = join(journalsDir, "global.md");
  if (existsSync(globalPath)) {
    try {
      const raw = await Bun.file(globalPath).text();
      const parsed = parseJournalEntries(raw);
      parsed.forEach((e) => entries.push({ ...e, _source: "global" }));
    } catch {}
  }

  // Project committed
  if (project) {
    const projPath = join(journalsDir, `${project}.md`);
    if (existsSync(projPath)) {
      try {
        const raw = await Bun.file(projPath).text();
        const parsed = parseJournalEntries(raw);
        parsed.forEach((e) => entries.push({ ...e, _source: "project" }));
      } catch {}
    }
  }

  // Staged / pending
  const staged: any[] = [];
  try {
    const pdir = project ? getPendingProjectDir(project) : null;
    if (pdir && existsSync(pdir)) {
      const files = readdirSync(pdir).filter((f) => f.endsWith(".md") && f !== ".gitkeep");
      for (const f of files) {
        const txt = await Bun.file(join(pdir, f)).text();
        const parsed = parseJournalEntries(txt);
        parsed.forEach((e) => {
          (e as any)._staged = true;
          (e as any)._source = "staged";
          staged.push(e);
        });
      }
    }
  } catch {}

  return { committed: entries, staged };
}

async function writePendingEntry(
  project: string,
  input: { title: string; pushback: number; tags: string[]; rationale: string; author?: string }
) {
  ensureDoravalDirs();
  const pendingDir = getPendingProjectDir(project);
  if (!existsSync(pendingDir)) {
    await Bun.write(join(pendingDir, ".gitkeep"), "");
  }

  const date = new Date().toISOString().split("T")[0];
  const slug = slugify(input.title);
  const filename = `${date}-${slug}.md`;
  const filePath = join(pendingDir, filename);

  const content = `## ${input.title}

\`\`\`yaml
pushback: ${input.pushback}
tags: [${input.tags.join(", ")}]
author: ${input.author || "human"}
date: ${date}
status: active
\`\`\`

${input.rationale}
`;

  await Bun.write(filePath, content);
  return { filePath, filename };
}

// --- Server ---

const DEFAULT_PORT = 3737;

/**
 * Kill any process listening on the given port (best-effort).
 * Useful so that `dora ui` can replace a previous instance.
 */
async function killPort(port: number) {
  if (process.platform === 'win32') {
    // Windows support is more complex; we just warn.
    return;
  }

  try {
    const proc = Bun.spawn(
      ['lsof', '-ti', `tcp:${port}`, '-sTCP:LISTEN'],
      { stdout: 'pipe', stderr: 'ignore' }
    );

    const output = (await new Response(proc.stdout).text()).trim();
    if (!output) return;

    const pids = output.split('\n').map(p => p.trim()).filter(Boolean);

    console.error(`  Killing previous doraval ui on port ${port}...`);
    for (const pid of pids) {
      console.error(`    → kill -9 ${pid}`);
      Bun.spawn(['kill', '-9', pid], { stdout: 'ignore', stderr: 'ignore' });
    }

    // Give the OS a moment to release the port
    await new Promise(r => setTimeout(r, 400));
  } catch {
    // lsof not available or no permission — silently ignore
  }
}

export default {
  async run({ args }: { args: any }) {
    const port = Number(args.port) || DEFAULT_PORT;
    const host = args.host || "127.0.0.1";
    const shouldOpen = args.open !== false;

    await killPort(port);

    const config = await readConfig();
    let project = resolveProjectName(config) ?? undefined;
    if (project) {
      try {
        project = sanitizeProjectName(project);
      } catch {
        project = undefined;
      }
    }

    const server = Bun.serve({
      port,
      hostname: host,
      async fetch(req) {
        const url = new URL(req.url);

        // Serve the dashboard shell
        if (url.pathname === "/" || url.pathname === "/index.html") {
          const html = await getDashboardHtml();
          return new Response(html, {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }

        // API
        if (url.pathname === "/api/status") {
          return Response.json({
            project: project || null,
            doravalDir: getJournalsDir(),
            hasConfig: !!config,
            repo: config?.journal?.repo ?? null,
          });
        }

        if (url.pathname === "/api/entries") {
          const { committed, staged } = await loadAllEntries(project || null);
          return Response.json({ project, committed, staged });
        }

        if (url.pathname === "/api/context") {
          const { committed, staged } = await loadAllEntries(project || null);
          const all = [...staged, ...committed].filter((e) => (e.status || "active") === "active");
          const text = generateJournalContext(all as any, project || null, { minPushback: 1 });
          return Response.json({ text, project });
        }

        if (url.pathname === "/api/hooks/status" && req.method === "GET") {
          const localPath = getLocalHooksPath();
          const globalPath = getGlobalSettingsPath();
          const localHas = hasHook(await readHookConfig(localPath));
          const globalHas = hasHook(await readHookConfig(globalPath));
          return Response.json({
            local: { enabled: localHas, path: localPath },
            global: { enabled: globalHas, path: globalPath },
          });
        }

        if (url.pathname === "/api/hooks/enable" && req.method === "POST") {
          const body = await req.json().catch(() => ({}));
          const useGlobal = !!body.global;
          const target = useGlobal ? getGlobalSettingsPath() : getLocalHooksPath();
          const res = await addHook(target);
          return Response.json(res);
        }

        if (url.pathname === "/api/hooks/disable" && req.method === "POST") {
          const body = await req.json().catch(() => ({}));
          const useGlobal = !!body.global;
          const target = useGlobal ? getGlobalSettingsPath() : getLocalHooksPath();
          const res = await removeHook(target);
          return Response.json(res);
        }

        if (url.pathname === "/api/add" && req.method === "POST") {
          if (!project) {
            return Response.json({ error: "No project configured. Run dora init or dora journal init first." }, { status: 400 });
          }
          const body = await req.json();
          const title = String(body.title || "Untitled decision").trim();
          const pushback = Number(body.pushback ?? 4);
          const tags = Array.isArray(body.tags) ? body.tags.map((t: any) => String(t).trim()).filter(Boolean) : [];
          const rationale = String(body.rationale || title).trim();

          try {
            const result = await writePendingEntry(project, { title, pushback, tags, rationale });
            return Response.json({ ok: true, ...result });
          } catch (e: any) {
            return Response.json({ error: e.message }, { status: 500 });
          }
        }

        if (url.pathname === "/api/refresh" && req.method === "POST") {
          // Lightweight: just re-read everything (UI polls)
          const { committed, staged } = await loadAllEntries(project || null);
          return Response.json({ ok: true, committed, staged });
        }

        // Fallback 404 for API
        if (url.pathname.startsWith("/api/")) {
          return Response.json({ error: "Not found" }, { status: 404 });
        }

        return new Response("Not found", { status: 404 });
      },
    });

    const url = `http://${host === "0.0.0.0" ? "localhost" : host}:${server.port}`;

    // All human messages to stderr (preserve stdout hygiene for any future piping)
    const msg = `
  ${pc.blue("◉")}  doraval local dashboard
  ${pc.dim("Project:")} ${project ? pc.white(project) : pc.yellow("none (run dora init)")}
  ${pc.dim("URL:")}     ${pc.underline(pc.cyan(url))}

  ${pc.dim("Press Ctrl+C to stop")}
`;
    console.error(msg);

    if (shouldOpen && process.stdout.isTTY) {
      // macOS friendly + fallback
      try {
        const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        spawn(opener, [url], { stdio: "ignore", detached: true }).unref();
      } catch {
        console.error(pc.dim(`  Could not auto-open. Visit ${url}`));
      }
    }

    // Keep process alive
    process.on("SIGINT", () => {
      console.error("\n  Stopping dashboard...");
      server.stop();
      process.exit(0);
    });
  },
};

// --- Dashboard HTML (self-contained for fast first version) ---
// Tailwind via CDN + clean terminal-inspired UI. We can evolve to a built app later.
async function getDashboardHtml(): Promise<string> {
  // Support both:
  // - Running from source: bun run src/cli/index.ts ui
  // - Running built: bun bin/doraval.js ui  (after build copies src/ui -> bin/ui)
  const isSource = import.meta.url.includes('/src/');
  const htmlPath = isSource
    ? new URL("../../ui/index.html", import.meta.url)
    : new URL("./ui/index.html", import.meta.url);

  try {
    return await Bun.file(htmlPath).text();
  } catch (err) {
    console.error(`[doraval ui] Failed to load HTML from ${htmlPath}`);
    return `<!doctype html><meta charset="utf-8"><body style="font-family:monospace;background:#111;color:#ddd;padding:2rem"><h1>doraval ui</h1><p>Dashboard HTML missing.</p><pre>${String(err)}</pre></body>`;
  }
}

// Dashboard HTML served from src/ui/index.html (editable separately)
