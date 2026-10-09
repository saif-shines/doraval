import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { spawnSync } from "child_process";

const bin = resolve(import.meta.dir, "../../bin/entire-agent-hermes.cjs");

function run(args: string[], env: NodeJS.ProcessEnv = {}): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [bin, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

describe("entire-agent-hermes", () => {
  test("info names the hermes agent", () => {
    const result = run(["info"]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ protocol_version: 1, name: "hermes" });
  });

  test("detect is present only when HERMES_HOME exists", () => {
    const missing = run(["detect"], { HERMES_HOME: join(tmpdir(), "dora-hermes-missing-no-such") });
    expect(JSON.parse(missing.stdout)).toEqual({ present: false });
    const home = mkdtempSync(join(tmpdir(), "dora-hermes-home-"));
    const found = run(["detect"], { HERMES_HOME: home });
    expect(JSON.parse(found.stdout)).toEqual({ present: true });
  });

  test("read-transcript prints the session file", () => {
    const home = mkdtempSync(join(tmpdir(), "dora-hermes-log-"));
    const file = join(home, "session.jsonl");
    writeFileSync(file, "{\"prompt\":\"ship the skill\"}\n");
    const result = run(["read-transcript", "--session-ref", file]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ship the skill");
  });
});
