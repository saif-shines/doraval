import { readFile, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pageHtml from "./index.html" with { type: "text" };
import { defaultGrokHome, listSessions, loadTurns } from "./read.ts";

function resolveRoot(raw: string | null): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return defaultGrokHome();
  if (trimmed === "~") return homedir();
  if (trimmed.startsWith("~/")) return join(homedir(), trimmed.slice(2));
  return trimmed;
}

const fontFile: Record<string, string> = {
  "/fonts/inter.woff2": "inter.woff2",
  "/fonts/space-grotesk.woff2": "space-grotesk.woff2",
  "/fonts/jetbrains-mono.woff2": "jetbrains-mono.woff2",
};

const fontRoot = join(dirname(fileURLToPath(import.meta.url)), "fonts");

/** Local session page. Port 0 picks a free port. Bind is loopback only. */
export function startSessionPage(port = 0): Bun.Server<undefined> {
  return Bun.serve({
    hostname: "127.0.0.1",
    port,
    async fetch(req) {
      const url = new URL(req.url);
      const fontName = fontFile[url.pathname];
      if (fontName) {
        try {
          const body = await readFile(join(fontRoot, fontName));
          return new Response(body, { headers: { "content-type": "font/woff2" } });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      }
      if (url.pathname === "/") {
        return new Response(pageHtml as unknown as string, { headers: { "content-type": "text/html; charset=utf-8" } });
      }
      const root = resolveRoot(url.searchParams.get("root"));
      try {
        await realpath(root);
      } catch {
        return Response.json({ error: "Folder not found" }, { status: 404 });
      }
      if (url.pathname === "/api/sessions") {
        return Response.json({ root, rows: await listSessions(root) });
      }
      if (url.pathname === "/api/session") {
        const loaded = await loadTurns(root, url.searchParams.get("id") ?? "");
        if (!loaded) return Response.json({ error: "Session not found" }, { status: 404 });
        return Response.json(loaded);
      }
      return new Response("Not found", { status: 404 });
    },
  });
}
