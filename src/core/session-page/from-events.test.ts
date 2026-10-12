import { describe, expect, test } from "bun:test";
import { asSession } from "../session-parse.ts";
import { agentsIn, parseTraceId } from "./agents.ts";
import { sessionToView, viewFromLog } from "./from-events.ts";

describe("sessionToView", () => {
  test("groups a user turn, keeps a failed truncated command, and starts a new turn", () => {
    const session = asSession({
      sessionId: "s",
      model: "claude-sonnet",
      agent: "claude-code",
      cwd: "/proj",
      gitBranch: "main",
      toolCalls: [],
      toolCallCounts: {},
      skillsInvoked: ["ask-dora"],
      userMessages: ["hi", "next"],
      userTurnCount: 2,
      assistantText: ["yo"],
    }, [
      { sessionId: "s", seq: 0, type: "user", text: "hi" },
      { sessionId: "s", seq: 1, type: "tool_call", toolName: "Bash", toolCallId: "1", input: { command: "ls" } },
      { sessionId: "s", seq: 2, type: "tool_result", toolCallId: "1", output: "x".repeat(2001), isError: true },
      { sessionId: "s", seq: 3, type: "assistant", text: "yo" },
      { sessionId: "s", seq: 4, type: "user", text: "next" },
    ]);
    const view = sessionToView(session, "/log");
    expect(view.turns).toHaveLength(2);
    expect(view.turns[0]?.prompt).toBe("hi");
    expect(view.turns[0]?.reply).toBe("yo");
    expect(view.turns[0]?.tools[0]).toMatchObject({ name: "Bash", command: "ls", failed: true, outputTruncated: true });
    expect(view.turns[0]?.tools[0]?.output).toHaveLength(2000);
    expect(view.turns[1]?.prompt).toBe("next");
    expect(view.facts.skills).toEqual(["ask-dora"]);
    expect(view.folder).toBe("/proj");
    expect(view.branch).toBe("main");
  });
});

describe("claude logs", () => {
  test("shows thinking and permission decisions, and hides isMeta text", () => {
    const text = [
      JSON.stringify({ type: "user", message: { content: "real prompt" } }),
      JSON.stringify({ type: "user", isMeta: true, message: { content: "injected meta" } }),
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "thinking", thinking: "check the empty case", signature: "hide-me" },
            { type: "text", text: "fixed" },
            { type: "tool_use", id: "t1", name: "Edit", input: { file_path: "a.ts", old_string: "a", new_string: "b" } },
          ],
        },
      }),
      JSON.stringify({
        type: "user",
        permissionDecision: { decision: "reject", source: "hook", reasonType: "hook" },
        message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "no" }] },
      }),
    ].join("\n");
    const view = viewFromLog("claude-code", text, "s", "/proj", "s");
    expect(view.turns).toHaveLength(1);
    expect(view.turns[0]?.prompt).toBe("real prompt");
    expect(view.turns[0]?.reply).toBe("fixed");
    expect(view.turns[0]?.thinking).toBe("check the empty case");
    expect(view.turns[0]?.tools[0]).toMatchObject({ name: "Edit", failed: false });
    expect(view.facts.permissions).toEqual([{ tool: "Edit", decision: "reject" }]);
  });
});

describe("parseTraceId", () => {
  test("keeps a grok id bare and rejects a path", () => {
    expect(parseTraceId("aaaaaaaaaaaaaaaaaaaa")?.agent).toBe("grok");
    expect(parseTraceId("claude-code:abc")?.id).toBe("abc");
    expect(parseTraceId("gemini:session-1")?.agent).toBe("gemini");
    expect(parseTraceId("qwen:abc")).toBeNull();
    expect(parseTraceId("claude-code:../secret")).toBeNull();
    expect(parseTraceId("nope:abc")).toBeNull();
  });
});

describe("agentsIn", () => {
  test("keeps page order and puts an unknown agent last", () => {
    expect(agentsIn([{ agent: "gemini" }, { agent: "grok" }, { agent: "claude-code" }, { agent: "nope" }])).toEqual([
      "grok",
      "claude-code",
      "gemini",
      "nope",
    ]);
  });
});

describe("gemini logs", () => {
  test("reads a gemini jsonl chat, drops a rewound turn, and keeps thoughts out of the reply", () => {
    const text = [
      JSON.stringify({ sessionId: "g1", projectHash: "hash", summary: "fix auth", directories: ["/proj/gem"] }),
      JSON.stringify({ type: "user", id: "u1", content: [{ text: "gemini please" }] }),
      JSON.stringify({
        type: "gemini", id: "a1", model: "gemini-2.5-pro",
        content: [{ thought: true, text: "secret plan" }, { text: "looking" }],
        thoughts: [{ subject: "Check", description: "empty password is true" }],
        toolCalls: [{ id: "c1", name: "run_shell_command", args: { command: "ls" }, result: [{ text: "src" }], status: "success" }],
        tokens: { input: 3, output: 4, cached: 1, total: 8 },
      }),
      JSON.stringify({ type: "user", id: "u2", content: "later" }),
      JSON.stringify({ $rewindTo: "a1" }),
    ].join("\n");
    const view = viewFromLog("gemini", text, "session-gem-1", "hash", "session-gem-1");
    expect(view.title).toBe("fix auth");
    expect(view.model).toBe("gemini-2.5-pro");
    expect(view.folder).toBe("/proj/gem");
    expect(view.turns).toHaveLength(1);
    expect(view.turns[0]?.prompt).toBe("gemini please");
    expect(view.turns[0]?.reply).toBe("looking");
    expect(view.turns[0]?.thinking).toBe("Check: empty password is true\n\nsecret plan");
    expect(view.turns[0]?.outputTokens).toBe(4);
    expect(view.turns[0]?.tools[0]).toMatchObject({ name: "run_shell_command", command: "ls", output: "src" });
  });
});
