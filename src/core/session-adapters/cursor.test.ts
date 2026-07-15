import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createCursorAdapter } from "./cursor.js";

let home: string;
const CWD = "/Users/test/myproj";           // dashed: Users-test-myproj (no leading dash)

const TRANSCRIPT = [
  JSON.stringify({ role: "user", message: { content: [{ type: "text", text: "<user_query>\nfix the bug\n</user_query>" }] } }),
  JSON.stringify({ role: "assistant", message: { content: [
    { type: "text", text: "Looking at it." },
    { type: "tool_use", name: "Read", input: { path: "/Users/test/myproj/src/a.ts" } },
  ] } }),
].join("\n") + "\n";

beforeAll(() => {
  home = mkdtempSync(join(tmpdir(), "cursor-home-"));
  const tdir = join(home, ".cursor", "projects", "Users-test-myproj", "agent-transcripts", "aaaa-bbbb");
  mkdirSync(tdir, { recursive: true });
  writeFileSync(join(tdir, "aaaa-bbbb.jsonl"), TRANSCRIPT);
  // legacy numeric dir with a transcript — must be ignored (no cwd mapping)
  const legacy = join(home, ".cursor", "projects", "1777193733840", "agent-transcripts", "cccc");
  mkdirSync(legacy, { recursive: true });
  writeFileSync(join(legacy, "cccc.jsonl"), TRANSCRIPT);
  // subagent transcript — must be skipped
  const sub = join(home, ".cursor", "projects", "Users-test-myproj", "agent-transcripts", "aaaa-bbbb", "subagents", "dddd");
  mkdirSync(sub, { recursive: true });
  writeFileSync(join(sub, "dddd.jsonl"), TRANSCRIPT);
});
afterAll(() => rmSync(home, { recursive: true, force: true }));

describe("cursorAdapter", () => {
  test("detect true when ~/.cursor/projects exists, false otherwise", () => {
    expect(createCursorAdapter(home).detect()).toBe(true);
    expect(createCursorAdapter("/nonexistent-xyz").detect()).toBe(false);
  });

  test("lists only the main transcript for the mapped cwd", () => {
    const list = createCursorAdapter(home).listRecentSessions(CWD);
    expect(list).toHaveLength(1);                       // subagent + legacy excluded
    expect(list[0]!.path).toContain("aaaa-bbbb.jsonl");
  });

  test("parse maps roles, strips <user_query>, extracts tool_use", () => {
    const a = createCursorAdapter(home);
    const p = a.parse(a.listRecentSessions(CWD)[0]!.path);
    expect(p.agent).toBe("cursor");
    expect(p.sessionId).toBe("aaaa-bbbb");
    expect(p.cwd).toBe(CWD);
    expect(p.userMessages[0]).toBe("fix the bug");
    expect(p.toolCalls).toHaveLength(1);
    expect(p.toolCalls[0]!.name).toBe("Read");
    expect(p.model).toBe("unknown");
  });

  test("unmapped cwd → empty list", () => {
    expect(createCursorAdapter(home).listRecentSessions("/other/place")).toEqual([]);
  });
});
