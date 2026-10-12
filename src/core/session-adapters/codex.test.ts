import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, renameSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createCodexAdapter } from "./codex.js";
import { parseCodexRollout } from "./codex-parse.js";

let home: string;
const CWD = "/Users/test/myproj";

const ROLLOUT = [
  JSON.stringify({ timestamp: "2026-07-15T10:00:00Z", type: "session_meta", payload: {
    id: "codex-sess-1", session_id: "codex-sess-1", cwd: CWD, cli_version: "0.142.2", model_provider: "openai",
  } }),
  JSON.stringify({ timestamp: "2026-07-15T10:00:05Z", type: "response_item", payload: {
    type: "function_call", name: "exec_command",
    arguments: JSON.stringify({ cmd: "cat /Users/test/myproj/.claude/skills/foo/SKILL.md" }),
    call_id: "c1",
  } }),
  JSON.stringify({ timestamp: "2026-07-15T10:00:06Z", type: "response_item", payload: {
    type: "message", role: "user", content: [{ type: "input_text", text: "do the thing" }],
  } }),
  JSON.stringify({ timestamp: "2026-07-15T10:00:07Z", type: "response_item", payload: {
    type: "agent_message", message: "done",
  } }),
].join("\n") + "\n";

beforeAll(() => {
  home = mkdtempSync(join(tmpdir(), "codex-home-"));
  const day = join(home, ".codex", "sessions", "2026", "07", "15");
  mkdirSync(day, { recursive: true });
  const rolloutPath = join(day, "rollout-2026-07-15-codex-sess-1.jsonl");
  writeFileSync(rolloutPath, ROLLOUT);

  const db = new Database(join(home, ".codex", "state_5.sqlite"));
  db.run(`CREATE TABLE threads (
    id TEXT PRIMARY KEY, rollout_path TEXT NOT NULL, cwd TEXT NOT NULL, title TEXT NOT NULL DEFAULT '',
    model TEXT, git_branch TEXT, tokens_used INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0)`);
  db.run(
    `INSERT INTO threads (id, rollout_path, cwd, title, model, git_branch, tokens_used, archived, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    ["codex-sess-1", rolloutPath, CWD, "My thread", "gpt-5", "main", 4321, Date.now()]
  );
  db.run(
    `INSERT INTO threads (id, rollout_path, cwd, title, tokens_used, archived, updated_at)
     VALUES ('archived-1', ?, ?, 'Old', 1, 1, ?)`,   // archived → excluded
    [rolloutPath, CWD, Date.now()]
  );
  db.close();
});
afterAll(() => rmSync(home, { recursive: true, force: true }));

describe("codexAdapter", () => {
  test("detect", () => {
    expect(createCodexAdapter(home).detect()).toBe(true);
    expect(createCodexAdapter("/nonexistent-xyz").detect()).toBe(false);
  });

  test("lists via threads table, excludes archived, carries tokens + title", () => {
    const list = createCodexAdapter(home).listRecentSessions(CWD);
    expect(list).toHaveLength(1);
    expect(list[0]!.tokens).toBe(4321);
    expect(list[0]!.title).toBe("My thread");
  });

  test("parse: session_meta, JSON-string arguments, user message, agent message", () => {
    const a = createCodexAdapter(home);
    const p = a.parse(a.listRecentSessions(CWD)[0]!.path);
    expect(p.agent).toBe("codex");
    expect(p.sessionId).toBe("codex-sess-1");
    expect(p.cwd).toBe(CWD);
    expect(p.toolCalls[0]!.name).toBe("exec_command");
    expect(JSON.stringify(p.toolCalls[0]!.input)).toContain("SKILL.md");
    expect(p.userMessages[0]).toBe("do the thing");
    expect(p.assistantText[0]).toBe("done");
  });

  test("reads output_text, custom exec calls, and turn_context model", () => {
    const text = [
      JSON.stringify({ type: "session_meta", payload: { id: "s", cwd: CWD, model_provider: "openai" } }),
      JSON.stringify({ type: "turn_context", payload: { model: "gpt-test" } }),
      JSON.stringify({ type: "response_item", payload: { type: "message", role: "developer", content: [{ type: "input_text", text: "system prompt" }] } }),
      JSON.stringify({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "do the thing" }] } }),
      JSON.stringify({ type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "shipped" }] } }),
      JSON.stringify({ type: "response_item", payload: { type: "custom_tool_call", name: "exec", call_id: "e1", input: "pwd" } }),
      JSON.stringify({ type: "response_item", payload: { type: "custom_tool_call_output", call_id: "e1", output: [{ type: "output_text", text: "/tmp" }] } }),
      JSON.stringify({ type: "response_item", payload: { type: "agent_message", author: "child", recipient: "parent", content: [{ type: "input_text", text: "inter-agent" }] } }),
    ].join("\n");
    const parsed = parseCodexRollout(text);
    expect(parsed.model).toBe("gpt-test");
    expect(parsed.userMessages).toEqual(["do the thing"]);
    expect(parsed.assistantText).toEqual(["shipped"]);
    expect(parsed.toolCalls.map((tool) => tool.name)).toEqual(["exec"]);
    expect(parsed.toolCalls[0]?.input).toEqual({ command: "pwd" });
    expect(parsed.events.find((event) => event.type === "tool_result")?.output).toBe("/tmp");
  });

  test("sqlite missing → rollout-walk fallback still finds the session", () => {
    const db = join(home, ".codex", "state_5.sqlite");
    const bak = db + ".bak";
    renameSync(db, bak);
    try {
      const list = createCodexAdapter(home).listRecentSessions(CWD);
      expect(list).toHaveLength(1);
      expect(list[0]!.tokens).toBeUndefined();   // no threads row in fallback mode
    } finally {
      renameSync(bak, db);
    }
  });
});
