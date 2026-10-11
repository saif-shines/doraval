import { describe, expect, test } from "bun:test";
import { extractSessionFacts, groupUpdates } from "./group.ts";

function line(update: Record<string, unknown>): string {
  return JSON.stringify({ params: { update } });
}

describe("groupUpdates", () => {
  test("joins chunks into turns and keeps the tool path", () => {
    const text = [
      line({ sessionUpdate: "hook_execution", event_name: "session_start" }),
      line({ sessionUpdate: "user_message_chunk", content: { text: "I want to deeply brainstorm with you" } }),
      line({ sessionUpdate: "user_message_chunk", content: { text: "" } }),
      line({ sessionUpdate: "agent_message_chunk", content: { text: "We'll brainstorm" } }),
      line({
        sessionUpdate: "tool_call",
        toolCallId: "c1",
        title: "read_file",
        rawInput: { target_file: "/tmp/a.md" },
        _meta: { "x.ai/tool": { name: "read_file" } },
      }),
      line({
        sessionUpdate: "tool_call_update",
        toolCallId: "c1",
        status: "completed",
        locations: [{ path: "/tmp/a.md" }],
      }),
      line({ sessionUpdate: "turn_completed", usage: { outputTokens: 10 } }),
      line({ sessionUpdate: "user_message_chunk", content: { text: "next" } }),
      line({
        sessionUpdate: "tool_call",
        toolCallId: "c2",
        _meta: { "x.ai/tool": { name: "run_terminal_command" } },
      }),
      line({ sessionUpdate: "tool_call_update", toolCallId: "c2", status: "failed" }),
      line({ sessionUpdate: "turn_completed" }),
    ].join("\n");

    const turns = groupUpdates(text);

    expect(turns).toHaveLength(2);
    expect(turns[0]!.prompt).toBe("I want to deeply brainstorm with you");
    expect(turns[0]!.reply).toBe("We'll brainstorm");
    expect(turns[0]!.hooks).toBe(1);
    expect(turns[0]!.tools[0]).toEqual({ name: "read_file", path: "/tmp/a.md", failed: false });
    expect(turns[0]!.closed).toBe(true);
    expect(turns[1]!.tools[0]!.failed).toBe(true);
  });

  test("keeps command, output, tokens, thinking, skills, and file counts", () => {
    const huge = "z".repeat(5000);
    const text = [
      line({ sessionUpdate: "user_message_chunk", content: { text: "edit it" } }),
      line({ sessionUpdate: "agent_thought_chunk", content: { type: "thinking", text: "check the edge" } }),
      line({
        sessionUpdate: "tool_call",
        toolCallId: "w1",
        rawInput: { command: "bun test\nnow" },
        _meta: { "x.ai/tool": { name: "run_terminal_command" } },
      }),
      line({
        sessionUpdate: "tool_call_update",
        toolCallId: "w1",
        status: "completed",
        content: [{ type: "content", content: { type: "text", text: "x".repeat(2001) } }],
        duration_ms: 42,
      }),
      line({
        sessionUpdate: "tool_call",
        toolCallId: "e1",
        rawInput: { file_path: "/tmp/a.ts", old_string: "a\nb", new_string: "a\nb\nc" },
        _meta: { "x.ai/tool": { name: "search_replace" } },
      }),
      line({
        sessionUpdate: "tool_call",
        toolCallId: "s1",
        rawInput: { skill: "ponytail" },
        _meta: { "x.ai/tool": { name: "skill" } },
      }),
      line({
        sessionUpdate: "tool_call",
        toolCallId: "f1",
        rawInput: { file_path: "/tmp/new.ts", content: huge },
        _meta: { "x.ai/tool": { name: "write_file" } },
      }),
      line({
        sessionUpdate: "turn_completed",
        elapsed_ms: 1500,
        usage: {
          outputTokens: 9,
          cachedReadTokens: 3,
          cacheCreationTokens: 4,
          reasoningTokens: 5,
          cost: 1.25,
        },
      }),
    ].join("\n");

    const turn = groupUpdates(text)[0]!;
    const edit = turn.files?.[0]!;

    expect(turn.durationMs).toBe(1500);
    expect(turn.outputTokens).toBe(9);
    expect(turn.cacheReadTokens).toBe(3);
    expect(turn.cacheWriteTokens).toBe(4);
    expect(turn.reasoningTokens).toBe(5);
    expect(turn.thinking).toBe("check the edge");
    expect(turn.reply).toBe("");
    expect(turn.skills).toEqual(["ponytail"]);
    expect(turn).not.toHaveProperty("cost");
    expect(turn.tools[0]).toMatchObject({ command: "bun test now", durationMs: 42, failed: false });
    expect(turn.tools[0]).not.toHaveProperty("path");
    expect(turn.tools[0]!.output).toHaveLength(2000);
    expect(turn.tools[0]!.outputTruncated).toBe(true);
    expect(turn.costUsd).toBe(1.25);
    expect(edit).toMatchObject({ path: "/tmp/a.ts", added: 1, removed: 0 });
    expect(edit.diff).toContain("before:\na\nb");
    expect(edit.diff).toContain("after:\na\nb\nc");
    expect(turn.files?.[1]).toMatchObject({ path: "/tmp/new.ts", added: 1, removed: 0 });
    expect(turn.files?.[1]!.diff.length).toBeLessThanOrEqual(4000);
    expect(turn.files?.[1]!.diff.startsWith("after:\n")).toBe(true);
  });

  test("closes a turn only on turn_completed", () => {
    const text = [
      line({ sessionUpdate: "user_message_chunk", content: { text: "one" } }),
      line({ sessionUpdate: "agent_message_chunk", content: { text: "ack" } }),
      line({ sessionUpdate: "user_message_chunk", content: { text: "two" } }),
      line({ sessionUpdate: "turn_completed" }),
      line({ sessionUpdate: "user_message_chunk", content: { text: "three" } }),
      line({ sessionUpdate: "agent_message_chunk", content: { text: "later" } }),
    ].join("\n");

    const turns = groupUpdates(text);

    expect(turns).toHaveLength(2);
    expect(turns[0]).toMatchObject({ prompt: "one\n\ntwo", reply: "ack", closed: true });
    expect(turns[1]).toMatchObject({ prompt: "three", reply: "later", closed: false });
  });

  test("counts changed lines, not unchanged lines in the blobs", () => {
    const text = [
      line({
        sessionUpdate: "tool_call",
        toolCallId: "swap",
        rawInput: { file_path: "/tmp/a.ts", old_string: "a\nb\n", new_string: "a\nc\n" },
        _meta: { "x.ai/tool": { name: "search_replace" } },
      }),
      line({
        sessionUpdate: "tool_call",
        toolCallId: "empty",
        rawInput: { path: "/tmp/empty.ts", old_string: "", new_string: "a\nb\n" },
        _meta: { "x.ai/tool": { name: "search_replace" } },
      }),
      line({
        sessionUpdate: "tool_call",
        toolCallId: "clear",
        rawInput: { target_file: "/tmp/clear.ts", old_string: "a\nb\n", new_string: "" },
        _meta: { "x.ai/tool": { name: "search_replace" } },
      }),
    ].join("\n");

    const files = groupUpdates(text)[0]!.files ?? [];

    expect(files[0]).toMatchObject({ path: "/tmp/a.ts", added: 1, removed: 1 });
    expect(files[1]).toMatchObject({ path: "/tmp/empty.ts", added: 2, removed: 0 });
    expect(files[2]).toMatchObject({ path: "/tmp/clear.ts", added: 0, removed: 2 });
  });

  test("reads skill names from SKILL.md paths and Skill titles, not guessed keys", () => {
    const text = [
      line({
        sessionUpdate: "tool_call",
        toolCallId: "p",
        rawInput: {
          target_file: "/Users/me/.grok/skills/ponytail/SKILL.md",
          skill_name: "nope",
          slash_command: "nope2",
          commandName: "nope3",
        },
        _meta: { "x.ai/tool": { name: "read_file" } },
      }),
      line({
        sessionUpdate: "tool_call",
        toolCallId: "g",
        title: "Skill grilling",
        rawInput: { skillName: "camel", command_name: "snake", slashCommand: "slashy" },
        _meta: { "x.ai/tool": { name: "read_file" } },
      }),
      line({ sessionUpdate: "turn_completed" }),
    ].join("\n");

    expect(groupUpdates(text)[0]!.skills).toEqual(["ponytail", "grilling"]);
    expect(extractSessionFacts(text).skills).toEqual(["ponytail", "grilling"]);
  });

  test("keeps a shell command off the path", () => {
    const text = [
      line({
        sessionUpdate: "tool_call",
        toolCallId: "c",
        rawInput: { command: "bun test" },
        _meta: { "x.ai/tool": { name: "run_terminal_command" } },
      }),
      line({
        sessionUpdate: "tool_call",
        toolCallId: "r",
        rawInput: { command: "cat file", file_path: "/tmp/from-raw.ts" },
        locations: [{ path: "/tmp/from-loc.ts" }],
        _meta: { "x.ai/tool": { name: "read_file" } },
      }),
      line({
        sessionUpdate: "tool_call",
        toolCallId: "p",
        rawInput: { path: "/tmp/only-path.ts", command: "ignored" },
        _meta: { "x.ai/tool": { name: "read_file" } },
      }),
    ].join("\n");

    const tools = groupUpdates(text)[0]!.tools;

    expect(tools[0]).toMatchObject({ name: "run_terminal_command", command: "bun test" });
    expect(tools[0]).not.toHaveProperty("path");
    expect(tools[1]).toMatchObject({ path: "/tmp/from-loc.ts", command: "cat file" });
    expect(tools[2]).toMatchObject({ path: "/tmp/only-path.ts", command: "ignored" });
  });

  test("flags only tool output longer than 2000 characters", () => {
    const text = [
      line({
        sessionUpdate: "tool_call_update",
        toolCallId: "long",
        status: "completed",
        content: [{ type: "content", content: { type: "text", text: "x".repeat(2001) } }],
        _meta: { "x.ai/tool": { name: "read_file" } },
      }),
      line({
        sessionUpdate: "tool_call_update",
        toolCallId: "edge",
        status: "completed",
        content: [{ type: "content", content: { type: "text", text: "y".repeat(2000) } }],
        _meta: { "x.ai/tool": { name: "read_file" } },
      }),
      line({
        sessionUpdate: "tool_call_update",
        toolCallId: "short",
        status: "completed",
        content: [{ type: "content", content: { type: "text", text: "ok" } }],
        _meta: { "x.ai/tool": { name: "read_file" } },
      }),
    ].join("\n");

    const tools = groupUpdates(text)[0]!.tools;

    expect(tools[0]!.output).toHaveLength(2000);
    expect(tools[0]!.outputTruncated).toBe(true);
    expect(tools[1]!.output).toHaveLength(2000);
    expect(tools[1]).not.toHaveProperty("outputTruncated");
    expect(tools[2]!.output).toBe("ok");
    expect(tools[2]).not.toHaveProperty("outputTruncated");
  });
});

describe("extractSessionFacts", () => {
  test("joins subagents and does not invent a permission or a cost", () => {
    const text = [
      line({ sessionUpdate: "hook_execution", event_name: "pre_tool", runs: [{ name: "sandbox", status: "deny" }] }),
      line({
        sessionUpdate: "subagent_spawned",
        subagent_id: "s",
        child_session_id: "child",
        description: "Read the logs",
        model: "grok-4",
      }),
      line({
        sessionUpdate: "subagent_finished",
        child_session_id: "child",
        status: "completed",
        tool_calls: 7,
        duration_ms: 90,
      }),
      line({ sessionUpdate: "session_recap", summary: "Shipped the parser." }),
      line({ sessionUpdate: "permission_decision", tool: "run_terminal_command", decision: "deny" }),
      line({
        sessionUpdate: "tool_call",
        toolCallId: "k",
        rawInput: { command: "/implement" },
        _meta: { "x.ai/tool": { name: "skill" } },
      }),
      line({
        sessionUpdate: "tool_call",
        toolCallId: "t",
        rawInput: { command: "ls" },
        _meta: { "x.ai/tool": { name: "run_terminal_command" } },
      }),
    ].join("\n");

    const facts = extractSessionFacts(text);

    expect(facts.subagents).toEqual([
      { id: "s", description: "Read the logs", model: "grok-4", status: "completed", durationMs: 90, toolCalls: 7 },
    ]);
    expect(facts.recaps).toEqual(["Shipped the parser."]);
    expect(facts.permissions).toEqual([{ tool: "run_terminal_command", decision: "deny" }]);
    expect(facts.skills).toEqual(["implement"]);
    expect(facts).not.toHaveProperty("cost");
    expect(facts).not.toHaveProperty("costUsd");
  });

  test("sums finite turn costs and appends compaction text to recaps", () => {
    const text = [
      line({ sessionUpdate: "user_message_chunk", content: { text: "a" } }),
      line({ sessionUpdate: "auto_compact_started", summary: "Starting compact", message: "ignore" }),
      line({ sessionUpdate: "turn_completed", usage: { cost: 1.25 } }),
      line({ sessionUpdate: "user_message_chunk", content: { text: "b" } }),
      line({ sessionUpdate: "auto_compact_completed", message: "Compact done" }),
      line({ sessionUpdate: "turn_completed", usage: { cost: 0.5 } }),
      line({ sessionUpdate: "session_recap", summary: "Shipped the parser." }),
      line({ sessionUpdate: "compaction_checkpoint", text: "Checkpoint note" }),
      line({ sessionUpdate: "user_message_chunk", content: { text: "c" } }),
      line({ sessionUpdate: "turn_completed", usage: { cost: "1.25" } }),
      line({ sessionUpdate: "user_message_chunk", content: { text: "d" } }),
      line({ sessionUpdate: "turn_completed", usage: { cost: 0 } }),
      line({ sessionUpdate: "auto_compact_started" }),
    ].join("\n");

    const turns = groupUpdates(text);
    const facts = extractSessionFacts(text);

    expect(turns[0]!.costUsd).toBe(1.25);
    expect(turns[1]!.costUsd).toBe(0.5);
    expect(turns[2]).not.toHaveProperty("costUsd");
    expect(turns[3]!.costUsd).toBe(0);
    expect(turns[0]).not.toHaveProperty("cost");
    expect(facts.costUsd).toBe(1.75);
    expect(facts.recaps).toEqual(["Starting compact", "Compact done", "Shipped the parser.", "Checkpoint note"]);
  });
});
