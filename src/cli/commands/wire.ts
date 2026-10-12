import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { defineCommand } from "citty";
import { planWire } from "../../core/wire/plan.js";
import { startWireServer } from "../../core/wire/proxy.js";
import { stopWireChild } from "../../core/wire/stop.js";
import { ui } from "../out.js";
import { exit } from "../render/exit.js";

const STOP_GRACE_MS = 1500;

export default defineCommand({
  meta: {
    name: "wire",
    description: "Record the request the model received, then start the agent",
  },
  args: {
    for: { type: "string", description: "Agent: claude, codex, or cursor" },
    run: { type: "boolean", description: "Start the agent in this terminal", default: false },
    chatgpt: { type: "boolean", description: "Codex ChatGPT sign-in", default: false },
    "api-key": { type: "boolean", description: "Codex API key", default: false },
  },
  async run({ args }) {
    const plan = planWire({
      forAgent: args.for as string | undefined,
      run: Boolean(args.run),
      chatgpt: Boolean(args.chatgpt),
      apiKey: Boolean(args["api-key"]),
    });
    if (!plan.ok) {
      ui.fail(plan.message);
      await exit(plan.exitCode);
      return;
    }
    const target = plan.target;
    const logsDir = join(homedir(), ".doraval", "wire");
    let server: Awaited<ReturnType<typeof startWireServer>>;
    try {
      server = await startWireServer({
        listenPort: target.port,
        upstreamHost: target.upstreamHost,
        upstreamPort: 443,
        protocol: "https",
        logsDir,
        agent: target.agent,
        onLine: (line) => ui.warn(line),
      });
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      ui.fail(code === "EADDRINUSE" ? `Port ${target.port} is already in use.` : "Could not listen for the agent.");
      await exit(2);
      return;
    }

    ui.blank();
    ui.write(`Listening on http://127.0.0.1:${server.port}`);
    ui.write(`Logs: ${logsDir}`);
    ui.write(`Starting ${target.bin}. Ctrl+C stops both.`);
    ui.blank();

    const child = spawn(target.bin, target.args, {
      stdio: "inherit",
      env: { ...process.env, ...target.env },
    });
    let stopped = false;
    const stop = (code: number) => {
      if (stopped) return;
      stopped = true;
      void server.close();
      void exit(code);
    };
    child.on("error", (error: NodeJS.ErrnoException) => {
      ui.fail(error.code === "ENOENT" ? `${target.bin} is not on PATH.` : error.message);
      stop(2);
    });
    child.on("exit", (code, signal) => {
      if (stopped) return;
      stop(signal === "SIGINT" ? 130 : code ?? 1);
    });
    process.once("SIGINT", () => {
      if (stopped) return;
      stopped = true;
      void (async () => {
        try {
          await server.close();
        } finally {
          await stopWireChild(child, STOP_GRACE_MS);
          await exit(130);
        }
      })();
    });
  },
});
