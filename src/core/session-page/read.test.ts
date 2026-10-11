import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { countTurnCompleted, isHiddenCwd, isHiddenSession, listSessions, loadTurns } from "./read.ts";

const CHUNK = 1024 * 1024;

function line(update: Record<string, unknown>): string {
  return JSON.stringify({ params: { update } });
}

async function seed(
  root: string,
  id: string,
  cwd: string,
  updates: string,
  extra: { session_kind?: string; title?: string; lastActive?: string } = {},
): Promise<void> {
  const dir = join(root, "sessions", "g", id);
  await mkdir(dir, { recursive: true });
  const summary: Record<string, unknown> = {
    info: { id, cwd },
    session_summary: extra.title ?? id,
    current_model_id: "grok",
    head_branch: "main",
    last_active_at: extra.lastActive ?? "2026-01-02T00:00:00.000Z",
  };
  if (extra.session_kind) summary.session_kind = extra.session_kind;
  await writeFile(join(dir, "summary.json"), JSON.stringify(summary));
  await writeFile(join(dir, "updates.jsonl"), updates);
}

describe("isHiddenCwd", () => {
  test("hides tmp, private tmp, and var folders temp dirs", () => {
    expect(isHiddenCwd("/tmp")).toBe(true);
    expect(isHiddenCwd("/private/tmp")).toBe(true);
    expect(isHiddenCwd("/private/tmp/job")).toBe(true);
    expect(isHiddenCwd("/var/folders/ab/T/cd")).toBe(true);
    expect(isHiddenCwd("/private/var/folders/ab/T/cd")).toBe(true);
    expect(isHiddenCwd("/Users/saif/Experiments/doraval")).toBe(false);
    expect(isHiddenCwd("/private/tmpnot")).toBe(false);
    expect(isHiddenCwd("/var/folders/ab/Temporary")).toBe(false);
  });
});

describe("isHiddenSession", () => {
  test("hides subagent and subagent_resume only", () => {
    expect(isHiddenSession({ session_kind: "subagent" })).toBe(true);
    expect(isHiddenSession({ session_kind: "subagent_resume" })).toBe(true);
    expect(isHiddenSession({ session_kind: "headless" })).toBe(false);
    expect(isHiddenSession({})).toBe(false);
    expect(isHiddenSession(null)).toBe(false);
  });
});

describe("listSessions", () => {
  test("hides a temp cwd or a subagent kind, including a normal project cwd", async () => {
    const root = await mkdtemp(join(tmpdir(), "dora-hide-"));
    try {
      await seed(root, "11111111111111111111", "/Users/saif/Experiments/doraval", '"turn_completed"\n', {
        session_kind: "subagent",
      });
      await seed(root, "22222222222222222222", "/Users/saif/Experiments/doraval", "", {
        session_kind: "subagent_resume",
      });
      await seed(root, "33333333333333333333", "/private/tmp", "");
      await seed(root, "44444444444444444444", "/tmp", "");
      await seed(root, "55555555555555555555", "/private/tmp/job", "");
      await seed(root, "66666666666666666666", "/var/folders/ab/T/cd", "");
      await seed(root, "77777777777777777777", "/private/tmpnot", "");
      const rows = await listSessions(root);
      const byId = new Map(rows.map((row) => [row.id, row]));
      expect(byId.get("11111111111111111111")?.hidden).toBe(true);
      expect(byId.get("11111111111111111111")?.turns).toBeNull();
      expect(byId.get("22222222222222222222")?.hidden).toBe(true);
      expect(byId.get("33333333333333333333")?.hidden).toBe(true);
      expect(byId.get("44444444444444444444")?.hidden).toBe(true);
      expect(byId.get("55555555555555555555")?.hidden).toBe(true);
      expect(byId.get("66666666666666666666")?.hidden).toBe(true);
      expect(byId.get("77777777777777777777")?.hidden).toBe(false);
      const opened = await loadTurns(root, "11111111111111111111");
      expect(opened?.row.hidden).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("counts turn_completed on the newest visible rows and does not parse the log", async () => {
    const root = await mkdtemp(join(tmpdir(), "dora-newest-"));
    try {
      const ids: string[] = [];
      for (let n = 0; n < 31; n++) {
        const id = `a${n.toString(16).padStart(19, "0")}`;
        ids.push(id);
        const updates = n === 30 ? '"turn_completed"\n"turn_completed"\n' : '"turn_completed"\n';
        await seed(root, id, "/proj/app", updates, {
          lastActive: `2026-03-01T00:00:${String(n).padStart(2, "0")}.000Z`,
        });
      }
      const hiddenId = "abbbbbbbbbbbbbbbbbbb";
      await seed(root, hiddenId, "/proj/app", '"turn_completed"\n'.repeat(4), {
        session_kind: "subagent",
        lastActive: "2026-04-01T00:00:00.000Z",
      });
      const rows = await listSessions(root);
      const byId = new Map(rows.map((row) => [row.id, row]));
      expect(byId.get(ids[30]!)?.turns).toBe(2);
      expect(byId.get(ids[1]!)?.turns).toBe(1);
      expect(byId.get(ids[0]!)?.turns).toBeNull();
      expect(byId.get(hiddenId)?.hidden).toBe(true);
      expect(byId.get(hiddenId)?.turns).toBeNull();
      const loaded = await loadTurns(root, ids[30]!);
      expect(loaded?.turns).toHaveLength(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("a path cached for one root does not satisfy another root", async () => {
    const id = "eeeeeeeeeeeeeeeeeeee";
    const rootA = await mkdtemp(join(tmpdir(), "dora-root-a-"));
    const rootB = await mkdtemp(join(tmpdir(), "dora-root-b-"));
    try {
      await seed(rootA, id, "/proj/a", '"turn_completed"\n', { title: "alpha" });
      await seed(rootB, id, "/proj/b", '"turn_completed"\n"turn_completed"\n', { title: "beta" });
      await listSessions(rootA);
      expect((await loadTurns(rootB, id))?.row.title).toBe("beta");
      expect((await loadTurns(rootB, id))?.facts.logPath).toBe(join(rootB, "sessions", "g", id, "updates.jsonl"));
      await listSessions(rootB);
      expect((await loadTurns(rootA, id))?.row.title).toBe("alpha");
      expect((await loadTurns(rootA, id))?.facts.logPath).toBe(join(rootA, "sessions", "g", id, "updates.jsonl"));
      expect((await listSessions(rootB)).find((row) => row.id === id)?.turns).toBe(2);
    } finally {
      await rm(rootA, { recursive: true, force: true });
      await rm(rootB, { recursive: true, force: true });
    }
  });
});

describe("loadTurns", () => {
  test("rolls file diffs up by path and leaves cost unset", async () => {
    const root = await mkdtemp(join(tmpdir(), "dora-files-"));
    const id = "dddddddddddddddddddd";
    const longDiff = "before:\nline1\nline2\nline3\nafter:\nw\nx\ny\nz";
    try {
      await seed(
        root,
        id,
        "/proj/app",
        [
          line({
            sessionUpdate: "tool_call",
            toolCallId: "e1",
            rawInput: { file_path: "/proj/a.ts", old_string: "line1\nline2\nline3", new_string: "w\nx\ny\nz" },
            _meta: { "x.ai/tool": { name: "search_replace" } },
          }),
          line({
            sessionUpdate: "tool_call",
            toolCallId: "e2",
            rawInput: { file_path: "/proj/a.ts", old_string: "a", new_string: "b" },
            _meta: { "x.ai/tool": { name: "search_replace" } },
          }),
          line({
            sessionUpdate: "tool_call",
            toolCallId: "e3",
            rawInput: { file_path: "/proj/b.ts", old_string: "q", new_string: "qq" },
            _meta: { "x.ai/tool": { name: "search_replace" } },
          }),
          line({ sessionUpdate: "turn_completed" }),
        ].join("\n"),
      );
      const loaded = await loadTurns(root, id);
      const files = loaded?.facts.files ?? [];
      const edited = files.find((file) => file.path === "/proj/a.ts");
      const other = files.find((file) => file.path === "/proj/b.ts");
      expect(edited).toMatchObject({ path: "/proj/a.ts", added: 5, removed: 4, diff: longDiff });
      expect(other).toMatchObject({ path: "/proj/b.ts", added: 1, removed: 1, diff: "before:\nq\nafter:\nqq" });
      expect(loaded?.facts.costUsd).toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("loadTurns cost", () => {
  test("uses the numeric session cost, including zero, and skips a string cost", async () => {
    const root = await mkdtemp(join(tmpdir(), "dora-cost-"));
    const id = "ffffffffffffffffff01";
    const zeroId = "ffffffffffffffffff02";
    try {
      await seed(
        root,
        id,
        "/proj/app",
        [
          line({ sessionUpdate: "user_message_chunk", content: { text: "a" } }),
          line({ sessionUpdate: "turn_completed", usage: { cost: 1.25 } }),
          line({ sessionUpdate: "user_message_chunk", content: { text: "b" } }),
          line({ sessionUpdate: "turn_completed", usage: { cost: 0.5 } }),
          line({ sessionUpdate: "user_message_chunk", content: { text: "c" } }),
          line({ sessionUpdate: "turn_completed", usage: { cost: "1.25" } }),
          line({ sessionUpdate: "user_message_chunk", content: { text: "d" } }),
          line({ sessionUpdate: "turn_completed", usage: { cost: 0 } }),
        ].join("\n"),
      );
      await seed(
        root,
        zeroId,
        "/proj/app",
        [
          line({ sessionUpdate: "user_message_chunk", content: { text: "z" } }),
          line({ sessionUpdate: "turn_completed", usage: { cost: 0 } }),
        ].join("\n"),
      );
      expect((await loadTurns(root, id))?.facts.costUsd).toBe(1.75);
      expect((await loadTurns(root, zeroId))?.facts.costUsd).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("countTurnCompleted", () => {
  test("counts a needle split across a 1 MiB chunk once, and two needles as two", async () => {
    const dir = await mkdtemp(join(tmpdir(), "dora-turns-"));
    try {
      const needle = '"turn_completed"';
      const splitAt = CHUNK - 4;
      const buf = Buffer.alloc(splitAt + needle.length);
      buf.write(needle, splitAt);
      const splitFile = join(dir, "split.jsonl");
      await writeFile(splitFile, buf);
      expect(await countTurnCompleted(splitFile)).toBe(1);

      const two = join(dir, "two.jsonl");
      await writeFile(two, `${needle}\n${needle}\n`);
      expect(await countTurnCompleted(two)).toBe(2);

      const plain = join(dir, "plain.txt");
      await writeFile(plain, "turn_completed");
      expect(await countTurnCompleted(plain)).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
