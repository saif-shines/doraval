import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { WireAgent } from "./plan.js";
import { noteBurst, shouldLogWire, type BurstState } from "./policy.js";
import { decodeWireBody, renderWireMarkdown, wireStamp } from "./render.js";

export interface WireServerOptions {
  listenPort: number;
  upstreamHost: string;
  upstreamPort: number;
  protocol: "http" | "https";
  logsDir: string;
  agent: WireAgent;
  onLine?: (line: string) => void;
  now?: () => Date;
}

export function wireFileBase(logsDir: string, stamp: string, agent: string): string {
  const stem = `${stamp}_${agent}`;
  const taken = (base: string) =>
    existsSync(join(logsDir, `${base}.md`))
    || existsSync(join(logsDir, `${base}.request.txt`))
    || existsSync(join(logsDir, `${base}.response.txt`));
  if (!taken(stem)) return stem;
  let n = 2;
  while (taken(`${stem}-${n}`)) n += 1;
  return `${stem}-${n}`;
}

const DROP = new Set(["host", "connection", "accept-encoding", "transfer-encoding", "content-length"]);

function headerRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, name) => {
    out[name] = value;
  });
  return out;
}

function forwardHeaders(headers: Record<string, string>, host: string, length: number): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (DROP.has(name.toLowerCase())) continue;
    out[name] = value;
  }
  out.host = host;
  out["content-length"] = length;
  return out;
}

export function startWireServer(options: WireServerOptions): Promise<{ port: number; close: () => Promise<void> }> {
  const burst: BurstState = { hits: [] };
  const warned = new Set<string>();
  const request = options.protocol === "https" ? httpsRequest : httpRequest;

  // Bun.serve, not node:http. Bun drops bytes written from an "upgrade" socket,
  // so a WebSocket probe never sees the 426. fetch() still receives that request.
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: options.listenPort,
    async fetch(req) {
      if (req.headers.get("upgrade")) {
        return new Response(null, { status: 426 });
      }
      const method = req.method;
      const url = new URL(req.url);
      const path = `${url.pathname}${url.search}`;
      const body = Buffer.from(await req.arrayBuffer());
      const incoming = headerRecord(req.headers);
      try {
        return await forward(method, path, incoming, body);
      } catch {
        return new Response(JSON.stringify({ error: "upstream" }), {
          status: 502,
          headers: { "content-type": "application/json" },
        });
      }
    },
  });

  function forward(method: string, path: string, incoming: Record<string, string>, body: Buffer): Promise<Response> {
    return new Promise((resolve, reject) => {
      const upstream = request({
        hostname: options.upstreamHost,
        port: options.upstreamPort,
        method,
        path,
        headers: forwardHeaders(incoming, options.upstreamHost, body.length),
      }, (up) => {
        const status = up.statusCode ?? 502;
        const headers = new Headers();
        for (const [name, value] of Object.entries(up.headers)) {
          if (value === undefined || name.toLowerCase() === "transfer-encoding") continue;
          headers.set(name, Array.isArray(value) ? value.join(", ") : String(value));
        }
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const chunks: Buffer[] = [];
            up.on("data", (chunk: Buffer) => {
              chunks.push(chunk);
              controller.enqueue(chunk);
            });
            up.on("end", () => {
              writeTurn(method, path, status, incoming, body, Buffer.concat(chunks));
              controller.close();
            });
            up.on("error", (error) => controller.error(error));
          },
        });
        resolve(new Response(stream, { status, headers }));
      });
      upstream.on("error", reject);
      upstream.end(body);
    });
  }

  function writeTurn(
    method: string,
    path: string,
    status: number,
    headers: Record<string, string>,
    requestBody: Buffer,
    responseBody: Buffer,
  ): void {
    if (!shouldLogWire(method, path)) return;
    const sig = `${method} ${path.split("?")[0]} ${status}`;
    const decision = noteBurst(burst, sig, Date.now());
    if (decision !== "write") {
      if (decision === "warn" && !warned.has(sig)) {
        warned.add(sig);
        options.onLine?.(`Stopped writing repeats of ${sig}`);
      }
      return;
    }
    try {
      mkdirSync(options.logsDir, { recursive: true });
      const now = options.now?.() ?? new Date();
      const base = wireFileBase(options.logsDir, wireStamp(now), options.agent);
      const md = renderWireMarkdown({
        at: now.toISOString(),
        agent: options.agent,
        method,
        path,
        status,
        headers,
        requestText: decodeWireBody(requestBody, headers["content-encoding"]),
        responseText: responseBody.toString("utf8"),
      });
      writeFileSync(join(options.logsDir, `${base}.md`), md);
      writeFileSync(join(options.logsDir, `${base}.request.txt`), requestBody);
      writeFileSync(join(options.logsDir, `${base}.response.txt`), responseBody);
    } catch (error) {
      options.onLine?.(error instanceof Error ? error.message : "Could not write the wire log.");
    }
  }

  return Promise.resolve({
    port: server.port ?? options.listenPort,
    close: () => {
      server.stop(true);
      return Promise.resolve();
    },
  });
}
