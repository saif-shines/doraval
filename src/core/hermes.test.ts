import { describe, expect, test } from "bun:test";
import { bootArgs, hermesSchedule, hermesTimeoutSec, onePassCommand, parseCronList, pauseArgs, resumeArgs } from "./hermes.js";
import type { Routine } from "./routine.js";

const routine: Routine = {
  slug: "night-pass",
  dir: "/tmp/night-pass",
  prompt: "Check the inbox.",
  skillsRun: ["/skills/run"],
  skillsRefer: ["/skills/refer"],
  mcpUrl: "https://gw.example/mcp",
  interval: "1h",
  maxTick: "10m",
};

describe("hermes command builders", () => {
  test("boot starts the gateway, adds MCP, and creates a cron job with mcp-scalekit", () => {
    const cmds = bootArgs(routine);
    expect(cmds[0]).toEqual(["gateway", "install"]);
    expect(cmds[1]).toEqual(["mcp", "add", "scalekit", "--url", "https://gw.example/mcp", "--auth", "oauth"]);
    expect(cmds[2]).toEqual([
      "cron",
      "create",
      "every 1h",
      "Check the inbox.",
      "--name",
      "night-pass",
      "--toolsets",
      "mcp-scalekit",
      "--timeout",
      "600",
      "--skill",
      "/skills/run",
    ]);
  });

  test("pause and resume target that job name only", () => {
    expect(pauseArgs("night-pass")).toEqual(["cron", "pause", "night-pass"]);
    expect(resumeArgs("night-pass")).toEqual(["cron", "resume", "night-pass"]);
  });

  test("one-pass command uses the MCP toolset and does not start a cron job", () => {
    const cmd = onePassCommand(routine);
    expect(cmd).toContain("hermes -z");
    expect(cmd).toContain("mcp-scalekit");
    expect(cmd).toContain("600");
    expect(cmd).not.toContain("cron");
  });
});

describe("schedule and timeout", () => {
  test("maps 1h to every 1h and 10m to 600s", () => {
    expect(hermesSchedule("1h")).toBe("every 1h");
    expect(hermesSchedule("every 15m")).toBe("every 15m");
    expect(hermesTimeoutSec("10m")).toBe(600);
    expect(hermesTimeoutSec("2m")).toBe(120);
  });
});

describe("parseCronList", () => {
  test("reads paused and active names", () => {
    const states = parseCronList("[active] night-pass\n[paused] other-job\n");
    expect(states.get("night-pass")).toBe("running");
    expect(states.get("other-job")).toBe("paused");
  });
});
