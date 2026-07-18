import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createGrokAdapter } from "./grok.js";

const CWD = "/Users/test/myproj";
const ENCODED = CWD.replace(/\//g, "%2F");
const SID = "019f0000-aaaa-7000-8000-000000000001";

function line(update: Record<string, unknown>, sessionId = SID): string {
  return JSON.stringify({
    timestamp: 1_700_000_000,
    method: "session/update",
    params: { sessionId, update },
  });
}

let home: string;

beforeAll(() => {
  home = mkdtempSync(join(tmpdir(), "grok-home-"));
  const sess = join(home, ".grok", "sessions", ENCODED, SID);
  mkdirSync(sess, { recursive: true });

  writeFileSync(
    join(sess, "summary.json"),
    JSON.stringify({
      info: { id: SID, cwd: CWD },
      session_summary: "Wire up Grok sessions",
      current_model_id: "grok-code-fast",
      head_branch: "main",
      updated_at: "2026-07-18T12:00:00Z",
    }),
  );

  writeFileSync(
    join(sess, "signals.json"),
    JSON.stringify({
      toolCallCount: 2,
      toolsUsed: ["read_file", "list_dir"],
      primaryModelId: "grok-code-fast",
      contextTokensUsed: 1200,
    }),
  );

  const updates = [
    line({
      sessionUpdate: "user_message_chunk",
      content: { type: "text", text: "use the review skill" },
    }),
    line({
      sessionUpdate: "tool_call",
      toolCallId: "t1",
      title: "read_file",
      rawInput: { target_file: "/Users/test/myproj/README.md" },
    }),
    line({
      sessionUpdate: "tool_call_update",
      toolCallId: "t2",
      kind: "read",
      title: "Skill using-superpowers",
      rawInput: {
        path: "/Users/test/.agents/skills/using-superpowers/SKILL.md",
      },
    }),
    line({
      sessionUpdate: "tool_call",
      toolCallId: "t3",
      title: "read_file",
      rawInput: {
        target_file: "/Users/test/.grok/skills/deploy/SKILL.md",
      },
    }),
    line({
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "Done." },
    }),
  ].join("\n") + "\n";
  writeFileSync(join(sess, "updates.jsonl"), updates);

  // Second older session (list ordering)
  const oldId = "019e0000-bbbb-7000-8000-000000000002";
  const oldSess = join(home, ".grok", "sessions", ENCODED, oldId);
  mkdirSync(oldSess, { recursive: true });
  writeFileSync(join(oldSess, "updates.jsonl"), line({ sessionUpdate: "user_message_chunk", content: { type: "text", text: "old" } }, oldId) + "\n");
  writeFileSync(join(oldSess, "summary.json"), JSON.stringify({ info: { id: oldId, cwd: CWD }, session_summary: "Older" }));
  // touch ordering: write older summary with older mtime via utimes not needed if we only check presence

  // Long-cwd group: hashed dir with .cwd file
  const longCwd = "/Users/test/" + "x".repeat(300) + "/proj";
  const hashGroup = join(home, ".grok", "sessions", "slug-abc123hash");
  mkdirSync(join(hashGroup, "019f0000-cccc-7000-8000-000000000003"), { recursive: true });
  writeFileSync(join(hashGroup, ".cwd"), longCwd + "\n");
  writeFileSync(
    join(hashGroup, "019f0000-cccc-7000-8000-000000000003", "updates.jsonl"),
    line(
      { sessionUpdate: "user_message_chunk", content: { type: "text", text: "long" } },
      "019f0000-cccc-7000-8000-000000000003",
    ) + "\n",
  );
});

afterAll(() => rmSync(home, { recursive: true, force: true }));

describe("grokAdapter (B-ix multi-file)", () => {
  test("detect under ~/.grok/sessions", () => {
    expect(createGrokAdapter(home).detect()).toBe(true);
    expect(createGrokAdapter("/nonexistent-xyz-home").detect()).toBe(false);
  });

  test("listRecentSessions uses summary title and session dir", () => {
    const list = createGrokAdapter(home).listRecentSessions(CWD);
    expect(list.length).toBeGreaterThanOrEqual(1);
    const top = list.find((x) => x.title === "Wire up Grok sessions" || x.path.includes(SID));
    expect(top).toBeDefined();
    expect(top!.path.replace(/\\/g, "/")).toContain(`${SID}/updates.jsonl`);
    expect(top!.skillCount).toBeGreaterThanOrEqual(1);
  });

  test("findLatestSession returns updates.jsonl under newest session dir", () => {
    const p = createGrokAdapter(home).findLatestSession(CWD);
    expect(p).toBeTruthy();
    expect(p!.replace(/\\/g, "/")).toMatch(/updates\.jsonl$/);
  });

  test("parse: stable sessionId from parent dir (not Date.now or updates.jsonl)", () => {
    const a = createGrokAdapter(home);
    const path = a.listRecentSessions(CWD).find((x) => x.path.includes(SID))!.path;
    const p1 = a.parse(path);
    const p2 = a.parse(path);
    expect(p1.sessionId).toBe(SID);
    expect(p2.sessionId).toBe(SID);
    expect(p1.sessionId).not.toMatch(/^grok-\d+$/);
  });

  test("parse: cwd/model/title from summary; tools + skills from updates", () => {
    const a = createGrokAdapter(home);
    const path = a.listRecentSessions(CWD).find((x) => x.path.includes(SID))!.path;
    const p = a.parse(path);
    expect(p.agent).toBe("grok");
    expect(p.cwd).toBe(CWD);
    expect(p.model).toBe("grok-code-fast");
    expect(p.sessionTitle).toBe("Wire up Grok sessions");
    expect(p.gitBranch).toBe("main");
    expect(p.userMessages).toContain("use the review skill");
    expect(p.toolCalls.some((t) => t.name === "read_file")).toBe(true);
    expect(p.skillsInvoked).toContain("using-superpowers");
    expect(p.skillsInvoked).toContain("deploy");
    expect(p.assistantText.some((t) => t.includes("Done"))).toBe(true);
  });

  test("resolves long-cwd group via .cwd file", () => {
    const longCwd = "/Users/test/" + "x".repeat(300) + "/proj";
    const list = createGrokAdapter(home).listRecentSessions(longCwd);
    expect(list.length).toBe(1);
    expect(list[0]!.path).toContain("019f0000-cccc-7000-8000-000000000003");
  });

  test("GROK_HOME overrides ~/.grok location", () => {
    const alt = mkdtempSync(join(tmpdir(), "grok-alt-"));
    const sid = "019f0000-dddd-7000-8000-000000000004";
    const sess = join(alt, "sessions", ENCODED, sid);
    mkdirSync(sess, { recursive: true });
    writeFileSync(
      join(sess, "updates.jsonl"),
      line({ sessionUpdate: "user_message_chunk", content: { type: "text", text: "alt home" } }, sid) + "\n",
    );
    writeFileSync(join(sess, "summary.json"), JSON.stringify({ info: { id: sid, cwd: CWD }, session_summary: "Alt" }));
    try {
      const a = createGrokAdapter(home, { grokHome: alt });
      expect(a.detect()).toBe(true);
      const list = a.listRecentSessions(CWD);
      // Should find alt sessions — may also find home sessions if not isolated.
      // Adapter with grokHome=alt only sees alt.
      expect(list.some((x) => x.path.includes(sid))).toBe(true);
      expect(list.every((x) => x.path.startsWith(alt) || x.path.includes("grok-alt-"))).toBe(true);
    } finally {
      rmSync(alt, { recursive: true, force: true });
    }
  });

  test("log fallback sessionId uses parent session dir name when path is under sessions", () => {
    const a = createGrokAdapter(home);
    const logDir = join(home, ".grok", "sessions", ENCODED, SID, "terminal");
    mkdirSync(logDir, { recursive: true });
    const logPath = join(logDir, "run.log");
    writeFileSync(logPath, "plain log body");
    const p = a.parse(logPath);
    expect(p.sessionId).toBe(SID);
  });
});
