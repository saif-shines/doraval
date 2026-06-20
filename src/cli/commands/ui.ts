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

import { existsSync, readdirSync, writeFileSync, unlinkSync, readFileSync, statSync } from "fs";
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
  getDoravalDir,
  getEvalsDir,
} from "../../core/journal-config.js";
import {
  parseJournalEntries,
  type JournalEntry,
} from "../../core/journal-parse.js";
import {
  generateJournalContext,
} from "./journal/context.js";

// Eval types (for dashboard display of learnings)
import type { EvalResult } from "../../core/session-eval.js";

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
          (e as any)._filename = f;
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

async function loadEvals(limit = 30): Promise<(EvalResult & { _filename?: string })[]> {
  const dir = getEvalsDir();
  if (!existsSync(dir)) return [];

  let files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ name: f, path: join(dir, f) }));

  // Newest first by filename (contains timestamp suffix)
  files.sort((a, b) => b.name.localeCompare(a.name));

  const results: (EvalResult & { _filename?: string })[] = [];
  for (const f of files.slice(0, limit)) {
    try {
      const raw = await Bun.file(f.path).text();
      const parsed = JSON.parse(raw) as EvalResult;
      if (parsed && (parsed.schemaVersion === 1 || parsed.verdict || parsed.skill)) {
        results.push({ ...parsed, _filename: f.name });
      }
    } catch {
      // ignore bad files
    }
  }

  // Ensure sorted by timestamp desc
  results.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  return results.slice(0, limit);
}

// --- Server ---

const DEFAULT_PORT = 3737;

/**
 * Legacy best-effort port killer (used only for first-run or --force without a tracked PID).
 * New launches prefer PID tracking for safety.
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

// --- PID management for idempotent ui launches (better than blind port kill) ---
// PID files are port-scoped (ui.<port>.pid) so `dora ui --port 4000` and default
// port are independent. This is safer + more correct than a single global pid.

const getPidFile = (p: number) => join(getDoravalDir(), `ui.${p}.pid`);

function readPid(p: number): number | null {
  const file = getPidFile(p);
  if (!existsSync(file)) return null;
  try {
    const raw = readFileSync(file, "utf8").trim();
    const pid = parseInt(raw, 10);
    if (isNaN(pid)) return null;
    // Check if process is still alive
    process.kill(pid, 0);
    return pid;
  } catch {
    // stale pid file
    try { unlinkSync(file); } catch {}
    return null;
  }
}

function writePid(pid: number, p: number) {
  ensureDoravalDirs();
  writeFileSync(getPidFile(p), String(pid) + "\n");
}

function removePid(p: number) {
  try { unlinkSync(getPidFile(p)); } catch {}
}

export default {
  async run({ args }: { args: any }) {
    const port = Number(args.port) || DEFAULT_PORT;
    const host = args.host || "127.0.0.1";
    const shouldOpen = args.open !== false;
    const showStatusOnly = !!args.status;
    const force = !!args.force;

    ensureDoravalDirs();

    const existingPid = readPid(port);

    if (showStatusOnly) {
      if (existingPid) {
        const url = `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`;
        console.error(`  Dashboard running (pid ${existingPid})`);
        console.error(`  URL:     ${pc.underline(pc.cyan(url))}`);
      } else {
        console.error(`  No dashboard running.`);
      }
      return;
    }

    if (existingPid && !force) {
      const url = `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`;
      console.error(`  Dashboard already running (pid ${existingPid}).`);
      console.error(`  URL:     ${pc.underline(pc.cyan(url))}`);
      if (shouldOpen && process.stdout.isTTY) {
        try {
          const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
          spawn(opener, [url], { stdio: "ignore", detached: true }).unref();
        } catch {}
      }
      return;
    }

    if (existingPid && force) {
      console.error(`  Force restarting (killing pid ${existingPid})...`);
      try { process.kill(existingPid, "SIGTERM"); } catch {}
      await new Promise((r) => setTimeout(r, 400));
      removePid(port);
    } else if (!existingPid) {
      // only do blind port kill if no pid and not our instance (legacy safety)
      await killPort(port);
    }

    const config = await readConfig();
    let project = resolveProjectName(config) ?? undefined;
    if (project) {
      try {
        project = sanitizeProjectName(project);
      } catch {
        project = undefined;
      }
    }

    let server: ReturnType<typeof Bun.serve>;
    try {
      server = Bun.serve({
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
            doravalRoot: getDoravalDir(),
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

        if (url.pathname === "/api/delete-staged" && req.method === "POST") {
          if (!project) {
            return Response.json({ error: "No project" }, { status: 400 });
          }
          const body = await req.json().catch(() => ({}));
          const filename = body.filename;
          if (!filename) {
            return Response.json({ error: "filename required" }, { status: 400 });
          }
          const pdir = getPendingProjectDir(project);
          const filePath = join(pdir, filename);
          if (existsSync(filePath)) {
            try { await Bun.file(filePath).unlink(); } catch {}
            return Response.json({ ok: true });
          }
          return Response.json({ error: "not found" }, { status: 404 });
        }

        if (url.pathname === "/api/evals") {
          const evals = await loadEvals(25);
          return Response.json({ evals });
        }

        // Fallback 404 for API
        if (url.pathname.startsWith("/api/")) {
          return Response.json({ error: "Not found" }, { status: 404 });
        }

        return new Response("Not found", { status: 404 });
      },
    });
    } catch (err: any) {
      removePid(port);
      console.error(`  Failed to start dashboard on port ${port}: ${err?.message || err}`);
      process.exit(1);
    }

    const url = `http://${host === "0.0.0.0" ? "localhost" : host}:${server.port}`;

    // write our pid (port-scoped)
    writePid(process.pid, port);

    // All human messages to stderr (preserve stdout hygiene for any future piping)
    const msg = `
  ${pc.blue("◉")}  dora local dashboard
  ${pc.dim("Project:")} ${project ? pc.white(project) : pc.yellow("none (run dora init)")}
  ${pc.dim("Data dir:")} ${getDoravalDir()}
  ${pc.dim("URL:")}     ${pc.underline(pc.cyan(url))}

  ${pc.dim("Press Ctrl+C to stop")}
`;
    console.error(msg);
    console.error(`  ${pc.dim("Tip:")} data location = ${getDoravalDir()} (set DORAVAL_HOME to change)`);

    if (shouldOpen && process.stdout.isTTY) {
      // macOS friendly + fallback
      try {
        const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        spawn(opener, [url], { stdio: "ignore", detached: true }).unref();
      } catch {
        console.error(pc.dim(`  Could not auto-open. Visit ${url}`));
      }
    }

    const cleanup = () => {
      removePid(port);
      console.error("\n  Stopping dashboard...");
      server.stop();
      process.exit(0);
    };

    // Keep process alive + cleanup pid
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
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
