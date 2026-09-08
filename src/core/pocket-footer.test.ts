import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawnSync } from "bun";
import { describe, expect, test } from "bun:test";
import {
  ensureHermesFooterHook,
  installPocketFooterHook,
  isPostTool,
  pocketFooter,
  recordJobSlug,
  resolveHookSlug,
  stampHookPayload,
  stampText,
  stampToolArgs,
  writeHookScript,
} from "./pocket-footer.js";

describe("stampText", () => {
  test("appends the footer when missing", () => {
    expect(stampText("LGTM", "saif-waiting-review")).toBe(
      "LGTM\n\nSent by pocket agent saif-waiting-review\n",
    );
  });

  test("does not duplicate the footer", () => {
    const once = stampText("LGTM", "saif-waiting-review");
    expect(stampText(once, "saif-waiting-review")).toBe(once);
  });
});

describe("isPostTool", () => {
  test("matches GitHub review and Slack post names", () => {
    expect(isPostTool("create_pull_request_review", {})).toBe(true);
    expect(isPostTool("slack_post_message", {})).toBe(true);
    expect(isPostTool("terminal", { command: "gh pr review 1 --approve --body hi" })).toBe(true);
    expect(isPostTool("read_file", { path: "x" })).toBe(false);
    expect(isPostTool("slack_search", { query: "approve" })).toBe(false);
  });
});

describe("stampToolArgs", () => {
  test("stamps a review body field", () => {
    const next = stampToolArgs({ body: "Looks good." }, "night-pass");
    expect(next?.body).toContain(pocketFooter("night-pass"));
    expect(String(next?.body).trim().endsWith(pocketFooter("night-pass"))).toBe(true);
  });

  test("stamps gh pr review --body", () => {
    const next = stampToolArgs({ command: 'gh pr review 12 --approve --body "ok"' }, "night-pass");
    expect(String(next?.command)).toContain(pocketFooter("night-pass"));
  });

  test("adds --body when gh pr review has none", () => {
    const next = stampToolArgs({ command: "gh pr review 12 --approve" }, "night-pass");
    expect(String(next?.command)).toContain("--body");
    expect(String(next?.command)).toContain(pocketFooter("night-pass"));
  });

  test("adds a review body when the model omitted it", () => {
    const next = stampToolArgs({ event: "APPROVE" }, "night-pass", "create_pull_request_review");
    expect(String(next?.body).trim().endsWith(pocketFooter("night-pass"))).toBe(true);
  });
});

describe("stampHookPayload", () => {
  test("modifies a GitHub review body when the slug is known", () => {
    const out = stampHookPayload(
      { tool_name: "create_pull_request_review", tool_input: { body: "Approve." } },
      "/tmp/unused",
      "saif-waiting-review",
    );
    expect(out?.action).toBe("modify");
    expect(String(out?.args.body)).toContain("Sent by pocket agent saif-waiting-review");
  });

  test("returns nothing for a non-post tool", () => {
    expect(
      stampHookPayload({ tool_name: "read_file", tool_input: { path: "a" } }, "/tmp", "x"),
    ).toBeUndefined();
  });

  test("returns nothing without a slug", () => {
    expect(
      stampHookPayload({ tool_name: "slack_post_message", tool_input: { text: "hi" } }, "/nope"),
    ).toBeUndefined();
  });
});

describe("resolveHookSlug", () => {
  test("reads cwd harness slug and job map", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-footer-home-"));
    expect(resolveHookSlug({ cwd: join(home, ".dora", "harness", "ooo-cal") }, home)).toBe("ooo-cal");
    recordJobSlug(home, "abcdef123456", "saif-waiting-review");
    expect(resolveHookSlug({ extra: { task_id: "abcdef123456" } }, home)).toBe("saif-waiting-review");
  });
});

describe("installPocketFooterHook", () => {
  test("writes the script and points Hermes config at it", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-footer-install-"));
    const script = installPocketFooterHook(home, "night-pass", "fedcba654321");
    expect(existsSync(script)).toBe(true);
    expect(readFileSync(script, "utf8")).toContain("pre_tool_call");
    const cfg = readFileSync(join(home, ".hermes", "config.yaml"), "utf8");
    expect(cfg).toContain(script);
    expect(cfg).toContain("pre_tool_call");
    expect(cfg).toContain("hooks_auto_accept");
    expect(resolveHookSlug({ extra: { task_id: "fedcba654321" } }, home)).toBe("night-pass");
    expect(ensureHermesFooterHook(home, script)).toBe(true);
    const again = readFileSync(join(home, ".hermes", "config.yaml"), "utf8");
    expect(again.split(script).length - 1).toBe(1);
  });

  test("keeps other Hermes config keys", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-footer-merge-"));
    mkdirSync(join(home, ".hermes"), { recursive: true });
    writeFileSync(join(home, ".hermes", "config.yaml"), 'model: "x"\nverbose: false\n');
    writeHookScript(home);
    expect(ensureHermesFooterHook(home, hookPath(home))).toBe(true);
    const cfg = readFileSync(join(home, ".hermes", "config.yaml"), "utf8");
    expect(cfg).toContain("model");
    expect(cfg).toContain("verbose");
  });

  test("does not rewrite invalid Hermes config", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-footer-badyml-"));
    mkdirSync(join(home, ".hermes"), { recursive: true });
    writeFileSync(join(home, ".hermes", "config.yaml"), "{\n");
    expect(ensureHermesFooterHook(home, hookPath(home))).toBe(false);
    expect(readFileSync(join(home, ".hermes", "config.yaml"), "utf8")).toBe("{\n");
  });
});

function hookPath(home: string): string {
  return join(home, ".dora", "hooks", "stamp-pocket-footer.py");
}

describe("python hook", () => {
  test("stamps a review body over stdin when python3 is present", () => {
    const py = spawnSync(["python3", "-c", "print(1)"], { stdout: "pipe", stderr: "pipe" });
    if ((py.exitCode ?? 1) !== 0) return;
    const home = mkdtempSync(join(tmpdir(), "dora-footer-py-"));
    const script = writeHookScript(home);
    recordJobSlug(home, "job1", "saif-waiting-review");
    const r = spawnSync(["python3", script], {
      stdin: new TextEncoder().encode(JSON.stringify({
        tool_name: "create_pull_request_review",
        tool_input: { body: "Ship it." },
        extra: { task_id: "job1" },
      })),
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, HOME: home },
    });
    expect(r.exitCode).toBe(0);
    const out = JSON.parse(r.stdout.toString() || "{}");
    expect(out.action).toBe("modify");
    expect(out.args.body).toContain("Sent by pocket agent saif-waiting-review");
  });

  test("adds --body on gh pr review over stdin", () => {
    const py = spawnSync(["python3", "-c", "print(1)"], { stdout: "pipe", stderr: "pipe" });
    if ((py.exitCode ?? 1) !== 0) return;
    const home = mkdtempSync(join(tmpdir(), "dora-footer-gh-"));
    const script = writeHookScript(home);
    recordJobSlug(home, "job1", "saif-waiting-review");
    const r = spawnSync(["python3", script], {
      stdin: new TextEncoder().encode(JSON.stringify({
        tool_name: "terminal",
        tool_input: { command: "gh pr review 12 --approve" },
        extra: { task_id: "job1" },
      })),
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, HOME: home },
    });
    expect(r.exitCode).toBe(0);
    const out = JSON.parse(r.stdout.toString() || "{}");
    expect(out.action).toBe("modify");
    expect(String(out.args.command)).toContain("Sent by pocket agent saif-waiting-review");
  });

  test("prints nothing on bad json", () => {
    const py = spawnSync(["python3", "-c", "print(1)"], { stdout: "pipe", stderr: "pipe" });
    if ((py.exitCode ?? 1) !== 0) return;
    const home = mkdtempSync(join(tmpdir(), "dora-footer-bad-"));
    const script = writeHookScript(home);
    const r = spawnSync(["python3", script], {
      stdin: new TextEncoder().encode("not-json"),
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, HOME: home },
    });
    expect(r.exitCode).toBe(0);
    expect(r.stdout.toString()).toBe("");
  });
});
