/** What `dora wire --run` will start. No network. */
export const WIRE_PORT = 8787;

export type WireAgent = "claude" | "codex";

export interface WireTarget {
  agent: WireAgent;
  bin: string;
  args: string[];
  env: Record<string, string>;
  upstreamHost: string;
  port: number;
}

export type WirePlan =
  | { ok: true; target: WireTarget }
  | { ok: false; exitCode: 2; message: string };

export function planWire(input: {
  forAgent?: string;
  run?: boolean;
  chatgpt?: boolean;
  apiKey?: boolean;
}): WirePlan {
  const port = WIRE_PORT;
  const agent = (input.forAgent ?? "").trim().toLowerCase();
  if (agent === "cursor") {
    return {
      ok: false,
      exitCode: 2,
      message: "Cursor builds the system prompt on its servers. dora wire cannot see it. dora session open still reads Cursor logs.",
    };
  }
  if (agent !== "claude" && agent !== "codex") {
    return { ok: false, exitCode: 2, message: "Pass --for claude or --for codex." };
  }
  if (!input.run) {
    return { ok: false, exitCode: 2, message: "Pass --run to start the agent in this terminal." };
  }
  if (agent === "claude" && (input.chatgpt || input.apiKey)) {
    return { ok: false, exitCode: 2, message: "Claude does not take --chatgpt or --api-key." };
  }
  if (agent === "codex" && input.chatgpt === input.apiKey) {
    return { ok: false, exitCode: 2, message: "Pass one of --chatgpt or --api-key." };
  }

  const local = `http://127.0.0.1:${port}`;
  if (agent === "claude") {
    return {
      ok: true,
      target: {
        agent,
        bin: "claude",
        args: [],
        env: { ANTHROPIC_BASE_URL: local, ENABLE_TOOL_SEARCH: "true" },
        upstreamHost: "api.anthropic.com",
        port,
      },
    };
  }
  const chatgpt = input.chatgpt === true;
  const suffix = chatgpt ? "/backend-api/codex" : "/v1";
  return {
    ok: true,
    target: {
      agent,
      bin: "codex",
      args: ["-c", `openai_base_url="${local}${suffix}"`],
      env: {},
      upstreamHost: chatgpt ? "chatgpt.com" : "api.openai.com",
      port,
    },
  };
}
