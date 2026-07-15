import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createCopilotAdapter } from "./copilot.js";

let home: string;
const CWD = "/Users/test/myproj";

const EVENTS = [
  JSON.stringify({ type: "session.start", data: { sessionId: "cp-1", copilotVersion: "1.0.47",
    context: { cwd: CWD, branch: "main" } }, timestamp: "2026-07-15T10:00:00Z" }),
  JSON.stringify({ type: "user.message", data: { content: "hello", transformedContent: "NOISE do not use" },
    timestamp: "2026-07-15T10:00:01Z" }),
  JSON.stringify({ type: "tool.execution_start", data: { toolCallId: "t1", toolName: "bash",
    arguments: { cmd: "ls .claude/skills/foo" }, turnId: "0" }, timestamp: "2026-07-15T10:00:02Z" }),
  JSON.stringify({ type: "assistant.message", data: { content: "done" }, timestamp: "2026-07-15T10:00:03Z" }),
  // real-data finding: assistant.message events with empty content are common (tool-only turns) —
  // must not pollute assistantText with blank entries
  JSON.stringify({ type: "assistant.message", data: { content: "" }, timestamp: "2026-07-15T10:00:04Z" }),
].join("\n") + "\n";

beforeAll(() => {
  home = mkdtempSync(join(tmpdir(), "copilot-home-"));
  mkdirSync(join(home, ".copilot", "session-state", "cp-1"), { recursive: true });
  writeFileSync(join(home, ".copilot", "session-state", "cp-1", "events.jsonl"), EVENTS);

  const db = new Database(join(home, ".copilot", "session-store.db"));
  db.run(`CREATE TABLE sessions ( id TEXT PRIMARY KEY, cwd TEXT, repository TEXT, host_type TEXT,
    branch TEXT, summary TEXT, created_at TEXT, updated_at TEXT )`);
  db.run(`INSERT INTO sessions (id, cwd, summary, updated_at) VALUES ('cp-1', ?, 'My session', '2026-07-15T10:00:00Z')`, [CWD]);
  // db row with NO events.jsonl — must be skipped, not crash
  db.run(`INSERT INTO sessions (id, cwd, summary, updated_at) VALUES ('cp-ghost', ?, 'Ghost', '2026-07-15T09:00:00Z')`, [CWD]);
  db.close();
});
afterAll(() => rmSync(home, { recursive: true, force: true }));

describe("copilotAdapter", () => {
  test("detect", () => {
    expect(createCopilotAdapter(home).detect()).toBe(true);
    expect(createCopilotAdapter("/nonexistent-xyz").detect()).toBe(false);
  });

  test("lists cwd-scoped sessions; row without events.jsonl skipped", () => {
    const list = createCopilotAdapter(home).listRecentSessions(CWD);
    expect(list).toHaveLength(1);
    expect(list[0]!.title).toBe("My session");
  });

  test("parse: session.start meta, tool events, content not transformedContent", () => {
    const a = createCopilotAdapter(home);
    const p = a.parse(a.listRecentSessions(CWD)[0]!.path);
    expect(p.agent).toBe("copilot");
    expect(p.sessionId).toBe("cp-1");
    expect(p.cwd).toBe(CWD);
    expect(p.gitBranch).toBe("main");
    expect(p.toolCalls[0]!.name).toBe("bash");
    expect(p.userMessages).toEqual(["hello"]);
    expect(p.assistantText).toEqual(["done"]);
  });
});
