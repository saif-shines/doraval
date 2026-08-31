import { mkdtempSync, readFileSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, test } from "bun:test";
import { listRoutineSlugs, openRoutine, readDefaultMcpUrl, readRoutine, writeDefaultMcpUrl, writeRoutine } from "./routine.js";

function tmpHome(): string {
  return mkdtempSync(join(tmpdir(), "dora-routine-"));
}

describe("writeRoutine", () => {
  test("writes ~/.dora/harness/<slug>/ with the folder contract", () => {
    const home = tmpHome();
    const dir = writeRoutine(home, {
      slug: "ooo-calendar",
      prompt: "Check the OOO calendar.",
      skillsRun: ["/skills/run"],
      skillsRefer: ["/skills/refer"],
      mcpUrl: "https://gw.example/mcp",
    });

    expect(dir).toBe(join(home, ".dora", "harness", "ooo-calendar"));
    expect(readFileSync(join(dir, "prompt.md"), "utf8")).toBe("Check the OOO calendar.\n");
    const yaml = readFileSync(join(dir, "routine.yml"), "utf8");
    expect(yaml).toContain('skills_run:\n  - "/skills/run"');
    expect(yaml).toContain('skills_refer:\n  - "/skills/refer"');
    expect(yaml).toContain('mcp_url: "https://gw.example/mcp"');
    expect(yaml).toContain('interval: "1h"');
    expect(yaml).toContain('max_tick: "10m"');
    expect(readdirSync(dir).sort()).toEqual(["prompt.md", "routine.yml"]);

    rmSync(home, { recursive: true, force: true });
  });

  test("interval and max tick can be set per routine", () => {
    const home = tmpHome();
    const dir = writeRoutine(home, {
      slug: "tight-job",
      prompt: "Ping.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
      interval: "15m",
      maxTick: "2m",
    });
    const yaml = readFileSync(join(dir, "routine.yml"), "utf8");
    expect(yaml).toContain('interval: "15m"');
    expect(yaml).toContain('max_tick: "2m"');
    expect(yaml).not.toContain('interval: "1h"');
    expect(yaml).not.toContain('max_tick: "10m"');
    rmSync(home, { recursive: true, force: true });
  });

  test("does not write a secrets file", () => {
    const home = tmpHome();
    const dir = writeRoutine(home, {
      slug: "clean",
      prompt: "Work.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const names = readdirSync(dir);
    expect(names.some((n) => /secret|\.env|token|credential/i.test(n))).toBe(false);
    const yaml = readFileSync(join(dir, "routine.yml"), "utf8");
    expect(yaml).not.toMatch(/api_key|token|password|secret/i);
    rmSync(home, { recursive: true, force: true });
  });

  test("quotes yaml values so a newline cannot add keys", () => {
    const home = tmpHome();
    const dir = writeRoutine(home, {
      slug: "quoted",
      prompt: "x",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp\nevil: true",
    });
    const yaml = readFileSync(join(dir, "routine.yml"), "utf8");
    expect(yaml).not.toMatch(/^evil:/m);
    expect(yaml).toContain("\\nevil: true");
    rmSync(home, { recursive: true, force: true });
  });
});

describe("readRoutine", () => {
  test("reads the folder contract back", () => {
    const home = tmpHome();
    writeRoutine(home, {
      slug: "ooo-calendar",
      prompt: "Check the OOO calendar.",
      skillsRun: ["/skills/run"],
      skillsRefer: ["/skills/refer"],
      mcpUrl: "https://gw.example/mcp",
    });
    const r = readRoutine(home, "ooo-calendar");
    expect(r.slug).toBe("ooo-calendar");
    expect(r.prompt).toBe("Check the OOO calendar.\n");
    expect(r.skillsRun).toEqual(["/skills/run"]);
    expect(r.skillsRefer).toEqual(["/skills/refer"]);
    expect(r.mcpUrl).toBe("https://gw.example/mcp");
    expect(r.interval).toBe("1h");
    expect(r.maxTick).toBe("10m");
    rmSync(home, { recursive: true, force: true });
  });
});

describe("default MCP URL", () => {
  test("saves a shared URL outside the routine folder", () => {
    const home = tmpHome();
    expect(readDefaultMcpUrl(home)).toBeUndefined();
    writeDefaultMcpUrl(home, "https://gw.example/mcp");
    expect(readDefaultMcpUrl(home)).toBe("https://gw.example/mcp");
    writeRoutine(home, {
      slug: "odd-job",
      prompt: "x",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://other.example/mcp",
    });
    expect(readDefaultMcpUrl(home)).toBe("https://gw.example/mcp");
    rmSync(home, { recursive: true, force: true });
  });
});

describe("listRoutineSlugs", () => {
  test("names existing slugs", () => {
    const home = tmpHome();
    expect(listRoutineSlugs(home)).toEqual([]);
    writeRoutine(home, {
      slug: "nightly-review",
      prompt: "Review.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    writeRoutine(home, {
      slug: "ooo-calendar",
      prompt: "Check OOO.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    expect(listRoutineSlugs(home)).toEqual(["nightly-review", "ooo-calendar"]);
    rmSync(home, { recursive: true, force: true });
  });
});

describe("openRoutine", () => {
  test("opens the routine folder", () => {
    const home = tmpHome();
    const dir = writeRoutine(home, {
      slug: "ooo-calendar",
      prompt: "Check OOO.",
      skillsRun: [],
      skillsRefer: [],
      mcpUrl: "https://gw.example/mcp",
    });
    const opened: string[] = [];
    expect(openRoutine(home, "ooo-calendar", (p) => opened.push(p))).toBe(dir);
    expect(opened).toEqual([dir]);
    rmSync(home, { recursive: true, force: true });
  });

  test("throws when the slug is missing", () => {
    const home = tmpHome();
    expect(() => openRoutine(home, "nope", () => {})).toThrow(/nope/);
    rmSync(home, { recursive: true, force: true });
  });
});

describe("slug", () => {
  test("rejects a path that leaves the harness root", () => {
    const home = tmpHome();
    expect(() =>
      writeRoutine(home, {
        slug: "../escape",
        prompt: "x",
        skillsRun: [],
        skillsRefer: [],
        mcpUrl: "https://gw.example/mcp",
      }),
    ).toThrow(/slug/i);
    rmSync(home, { recursive: true, force: true });
  });
});
