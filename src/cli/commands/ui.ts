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

import { existsSync, writeFileSync, unlinkSync, readFileSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import pc from "picocolors";

import { ui as cliUi } from "../out.js";
import {
  readConfig,
  resolveProjectName,
  getPendingProjectDir,
  ensureDoravalDirs,
  sanitizeProjectName,
  getDoravalDir,
  getJournalsDir,
} from "../../core/journal-config.js";
import { generateJournalContext } from "./journal/context.js";
import {
  loadAllEntries,
  writePendingEntry,
} from "../../core/views/journal-view.js";
import { loadEvals } from "../../core/views/evals-view.js";

// Hook pure functions (exported from hook.ts)
import {
  hasHook,
  addHook,
  removeHook,
  getLocalHooksPath,
  getGlobalSettingsPath,
  readHookConfig,
} from "./journal/hook.js";

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

    cliUi.write(`  Killing previous doraval ui on port ${port}...`);
    for (const pid of pids) {
      cliUi.write(`    → kill -9 ${pid}`);
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
        cliUi.write(`  Dashboard running (pid ${existingPid})`);
        cliUi.write(`  URL:     ${pc.underline(pc.cyan(url))}`);
      } else {
        cliUi.write(`  No dashboard running.`);
      }
      return;
    }

    if (existingPid && !force) {
      const url = `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`;
      cliUi.write(`  Dashboard already running (pid ${existingPid}).`);
      cliUi.write(`  URL:     ${pc.underline(pc.cyan(url))}`);
      if (shouldOpen && process.stdout.isTTY) {
        try {
          const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
          spawn(opener, [url], { stdio: "ignore", detached: true }).unref();
        } catch {}
      }
      return;
    }

    if (existingPid && force) {
      cliUi.write(`  Force restarting (killing pid ${existingPid})...`);
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
          const evals = await loadEvals({ limit: 25 });
          return Response.json({ evals });
        }

        if (url.pathname === "/api/open-dir" && req.method === "POST") {
          const dir = getDoravalDir();
          try {
            const opener = process.platform === "darwin"
              ? "open"
              : process.platform === "win32"
                ? "explorer"
                : "xdg-open";
            Bun.spawn([opener, dir], { stdout: "ignore", stderr: "ignore" });
          } catch {
            // best effort — opener may not be available
          }
          return Response.json({ ok: true, path: dir });
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
      cliUi.write(`  Failed to start dashboard on port ${port}: ${err?.message || err}`);
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
    cliUi.write(msg);
    cliUi.write(`  ${pc.dim("Tip:")} data location = ${getDoravalDir()} (set DORAVAL_HOME to change)`);

    if (shouldOpen && process.stdout.isTTY) {
      // macOS friendly + fallback
      try {
        const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        spawn(opener, [url], { stdio: "ignore", detached: true }).unref();
      } catch {
        cliUi.write(pc.dim(`  Could not auto-open. Visit ${url}`));
      }
    }

    const cleanup = () => {
      removePid(port);
      cliUi.write("\n  Stopping dashboard...");
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
    cliUi.write(`[doraval ui] Failed to load HTML from ${htmlPath}`);
    return `<!doctype html><meta charset="utf-8"><body style="font-family:monospace;background:#111;color:#ddd;padding:2rem"><h1>doraval ui</h1><p>Dashboard HTML missing.</p><pre>${String(err)}</pre></body>`;
  }
}

// Dashboard HTML served from src/ui/index.html (editable separately)
