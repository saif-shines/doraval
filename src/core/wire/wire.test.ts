import { createServer } from "node:http";
import { connect } from "node:net";
import { gzipSync } from "node:zlib";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { planWire } from "./plan.js";
import { noteBurst, shouldLogWire } from "./policy.js";
import { decodeWireBody, renderWireMarkdown } from "./render.js";
import { startWireServer, wireFileBase } from "./proxy.js";
import { stopWireChild } from "./stop.js";

describe("planWire", () => {
  test("claude starts with tool search and does not edit a config file", () => {
    const plan = planWire({ forAgent: "claude", run: true });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.target.env.ANTHROPIC_BASE_URL).toBe("http://127.0.0.1:8787");
    expect(plan.target.env.ENABLE_TOOL_SEARCH).toBe("true");
    expect(plan.target.bin).toBe("claude");
    expect(plan.target.args).toEqual([]);
    expect(plan.target.upstreamHost).toBe("api.anthropic.com");
  });

  test("codex chatgpt and api-key use different upstreams", () => {
    const chat = planWire({ forAgent: "codex", run: true, chatgpt: true });
    const key = planWire({ forAgent: "codex", run: true, apiKey: true });
    expect(chat.ok && key.ok).toBe(true);
    if (!chat.ok || !key.ok) return;
    expect(chat.target.args[1]).toContain("/backend-api/codex");
    expect(chat.target.upstreamHost).toBe("chatgpt.com");
    expect(key.target.args[1]).toContain("/v1");
    expect(key.target.upstreamHost).toBe("api.openai.com");
    expect(chat.target.env).toEqual({});
  });

  test("cursor and bad flags exit 2", () => {
    expect(planWire({ forAgent: "cursor", run: true }).ok).toBe(false);
    expect(planWire({ forAgent: "claude" }).ok).toBe(false);
    expect(planWire({ forAgent: "codex", run: true }).ok).toBe(false);
    expect(planWire({ forAgent: "codex", run: true, chatgpt: true, apiKey: true }).ok).toBe(false);
    const cursor = planWire({ forAgent: "cursor", run: true });
    if (!cursor.ok) expect(cursor.message).toContain("dora session open");
  });
});

describe("wire policy", () => {
  test("token counts and non-POST calls are not saved", () => {
    expect(shouldLogWire("POST", "/v1/messages")).toBe(true);
    expect(shouldLogWire("POST", "/v1/messages/count_tokens")).toBe(false);
    expect(shouldLogWire("POST", "/v1/messages:countTokens")).toBe(false);
    expect(shouldLogWire("GET", "/v1/models")).toBe(false);
  });

  test("the 21st identical call in the window is not written", () => {
    const state = { hits: [] as { sig: string; at: number }[] };
    const sig = "POST /v1/messages 200";
    const decisions = Array.from({ length: 22 }, (_, i) => noteBurst(state, sig, 1_000 + i));
    expect(decisions.filter((d) => d === "write")).toHaveLength(20);
    expect(decisions[20]).toBe("warn");
    expect(decisions[21]).toBe("suppress");
  });

  test("markdown redacts auth and keeps the system prompt", () => {
    const md = renderWireMarkdown({
      at: "t",
      agent: "claude",
      method: "POST",
      path: "/v1/messages",
      status: 200,
      headers: {
        authorization: "secret-token-value",
        cookie: "session-cookie-value",
        "content-type": "application/json",
      },
      requestText: JSON.stringify({ system: "be brief", messages: [{ role: "user", content: "hi" }] }),
      responseText: 'data: {"delta":{"text":"ok"}}\n',
    });
    expect(md).toContain("[REDACTED]");
    expect(md).not.toContain("secret-token-value");
    expect(md).not.toContain("session-cookie-value");
    expect(md).toContain("be brief");
    expect(md).toContain("ok");
    const zipped = gzipSync(Buffer.from("plain-body"));
    expect(decodeWireBody(zipped, "gzip")).toBe("plain-body");
  });
});

describe("stopWireChild", () => {
  // Windows terminates on SIGINT even when the script traps it, so the grace path cannot be observed there.
  test.skipIf(process.platform === "win32")("ctrl+c waits out the grace, then the ignoring child is gone", async () => {
    const child = spawn(process.execPath, [
      "-e",
      'process.on("SIGINT", () => {}); console.log("ready"); setInterval(() => {}, 1000);',
    ], { stdio: ["ignore", "pipe", "ignore"] });
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("child did not get ready")), 2000);
        child.stdout?.on("data", (buf) => {
          if (String(buf).includes("ready")) {
            clearTimeout(timer);
            resolve();
          }
        });
      });
      const started = Date.now();
      const code = await stopWireChild(child, 200);
      expect(code).toBe(130);
      expect(Date.now() - started).toBeGreaterThanOrEqual(180);
      expect(child.signalCode).toBe("SIGKILL");
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
  });

  test.skipIf(process.platform === "win32")("a failed force-kill does not finish while the child is alive", async () => {
    const child = spawn(process.execPath, [
      "-e",
      'process.on("SIGINT", () => {}); console.log("ready"); setInterval(() => {}, 1000);',
    ], { stdio: ["ignore", "pipe", "ignore"] });
    const orig = child.kill.bind(child);
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("child did not get ready")), 2000);
        child.stdout?.on("data", (buf) => {
          if (String(buf).includes("ready")) {
            clearTimeout(timer);
            resolve();
          }
        });
      });
      child.kill = ((signal?: NodeJS.Signals) => {
        if (signal === "SIGKILL") throw new Error("cannot signal");
        return orig(signal);
      }) as typeof child.kill;
      let resolved = false;
      const pending = stopWireChild(child, 40).then((code) => {
        resolved = true;
        return code;
      });
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(resolved).toBe(false);
      child.kill = orig;
      orig("SIGKILL");
      expect(await pending).toBe(130);
    } finally {
      if (child.exitCode === null && child.signalCode === null) orig("SIGKILL");
    }
  });
});

describe("wireFileBase", () => {
  test("a second turn in the same millisecond keeps the first files", () => {
    const dir = mkdtempSync(join(tmpdir(), "dora-wire-"));
    const stamp = "2026-01-01T00-00-00-000";
    const first = wireFileBase(dir, stamp, "claude");
    expect(first).toBe(`${stamp}_claude`);
    writeFileSync(join(dir, `${first}.md`), "one");
    writeFileSync(join(dir, `${first}.request.txt`), "req");
    writeFileSync(join(dir, `${first}.response.txt`), "res");
    expect(wireFileBase(dir, stamp, "claude")).toBe(`${stamp}_claude-2`);
    writeFileSync(join(dir, `${stamp}_claude-2.md`), "two");
    expect(readFileSync(join(dir, `${first}.md`), "utf8")).toBe("one");
    expect(wireFileBase(dir, stamp, "claude")).toBe(`${stamp}_claude-3`);
  });
});

describe("wire proxy", () => {
  test("forwards auth, redacts the log, skips token counts, and refuses upgrade", async () => {
    const logsDir = mkdtempSync(join(tmpdir(), "dora-wire-"));
    let seenAuth = "";
    const upstream = createServer((req, res) => {
      seenAuth = String(req.headers.authorization ?? "");
      res.end("data: {\"delta\":{\"text\":\"yo\"}}\n");
    });
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", () => resolve()));
    const upstreamPort = (upstream.address() as { port: number }).port;
    const proxy = await startWireServer({
      listenPort: 0,
      upstreamHost: "127.0.0.1",
      upstreamPort,
      protocol: "http",
      logsDir,
      agent: "claude",
    });

    const post = (path: string) => fetch(`http://127.0.0.1:${proxy.port}${path}`, {
      method: "POST",
      headers: {
        authorization: "secret-token-value",
        cookie: "session-cookie-value",
        "content-type": "application/json",
      },
      body: JSON.stringify({ system: "be brief", messages: [{ role: "user", content: "hi" }] }),
    });
    const saved = await post("/v1/messages");
    expect(saved.status).toBe(200);
    expect(await saved.text()).toContain("yo");
    expect(seenAuth).toBe("secret-token-value");
    await post("/v1/messages/count_tokens");

    const names = readdirSync(logsDir);
    expect(names.filter((name) => name.endsWith(".md"))).toHaveLength(1);
    const md = readFileSync(join(logsDir, names.find((name) => name.endsWith(".md"))!), "utf8");
    const raw = readFileSync(join(logsDir, names.find((name) => name.endsWith(".request.txt"))!), "utf8");
    expect(md).toContain("[REDACTED]");
    expect(md).toContain("be brief");
    expect(md).not.toContain("secret-token-value");
    expect(md).not.toContain("session-cookie-value");
    expect(raw).not.toContain("secret-token-value");
    expect(raw).not.toContain("session-cookie-value");
    expect(raw).toContain("be brief");

    const upgrade = await new Promise<string>((resolve, reject) => {
      const socket = connect(proxy.port, "127.0.0.1", () => {
        socket.write("GET / HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n");
      });
      let buf = "";
      socket.on("data", (chunk) => {
        buf += chunk.toString();
        if (buf.includes("\r\n\r\n")) {
          socket.end();
          resolve(buf);
        }
      });
      socket.on("error", reject);
    });
    expect(upgrade.startsWith("HTTP/1.1 426")).toBe(true);

    await proxy.close();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  });

  test("two turns on one clock keep both files", async () => {
    const logsDir = mkdtempSync(join(tmpdir(), "dora-wire-"));
    const fixed = new Date("2026-01-01T00:00:00.000Z");
    const upstream = createServer((_req, res) => {
      res.end("ok");
    });
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", () => resolve()));
    const upstreamPort = (upstream.address() as { port: number }).port;
    const proxy = await startWireServer({
      listenPort: 0,
      upstreamHost: "127.0.0.1",
      upstreamPort,
      protocol: "http",
      logsDir,
      agent: "claude",
      now: () => fixed,
    });
    const post = (system: string) => fetch(`http://127.0.0.1:${proxy.port}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ system, messages: [{ role: "user", content: "hi" }] }),
    });
    expect((await post("turn-one")).status).toBe(200);
    expect((await post("turn-two")).status).toBe(200);
    const mds = readdirSync(logsDir).filter((name) => name.endsWith(".md")).sort();
    expect(mds).toEqual([
      "2026-01-01T00-00-00-000_claude-2.md",
      "2026-01-01T00-00-00-000_claude.md",
    ]);
    expect(readFileSync(join(logsDir, mds[1]!), "utf8")).toContain("turn-one");
    expect(readFileSync(join(logsDir, mds[0]!), "utf8")).toContain("turn-two");
    expect(readFileSync(join(logsDir, mds[1]!), "utf8")).not.toContain("turn-two");
    await proxy.close();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  });
});
