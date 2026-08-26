import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  applyRemove,
  applyRestore,
  isRecentInstall,
  isRemoveCandidate,
  listQuarantine,
  listRemoveCandidates,
  listUnusedReport,
  resolveInstallAgeDays,
  planRemove,
  planRestore,
  resolveSkillName,
} from "./skill-remove.js";
import { utimesSync } from "fs";
import type { LoadResult } from "./session-evidence.js";
import { existsSync } from "fs";

function writeSkill(root: string, rel: string, name: string): string {
  const dir = join(root, rel);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: "Use when testing"\n---\n\n1. Do the thing\n`);
  return dir;
}

describe("isRemoveCandidate", () => {
  test("Authored + never invoked + not a Recent install is a Remove candidate", () => {
    expect(isRemoveCandidate({ origin: "authored", invoked: false, recentInstall: false })).toBe(true);
  });

  test("Recent install is not a Remove candidate", () => {
    expect(isRemoveCandidate({ origin: "authored", invoked: false, recentInstall: true })).toBe(false);
  });

  test("Global is not a Remove candidate", () => {
    expect(isRemoveCandidate({ origin: "global", invoked: false, recentInstall: false })).toBe(false);
  });

  test("Global scope allows a Global Skill and refuses an Authored Skill", () => {
    expect(isRemoveCandidate({ origin: "global", invoked: false, recentInstall: false, scope: "global" })).toBe(true);
    expect(isRemoveCandidate({ origin: "authored", invoked: false, recentInstall: false, scope: "global" })).toBe(false);
  });

  test("Invoked Authored Skill is not a Remove candidate", () => {
    expect(isRemoveCandidate({ origin: "authored", invoked: true, recentInstall: false })).toBe(false);
  });

  test("Imported is not a Remove candidate", () => {
    expect(isRemoveCandidate({ origin: "imported", invoked: false, recentInstall: false })).toBe(false);
  });
});

describe("isRecentInstall", () => {
  const day = 24 * 60 * 60 * 1000;
  const now = 1_700_000_000_000;

  test("mtime from 20 days ago is a Recent install", () => {
    expect(isRecentInstall(now - 20 * day, now, 90)).toBe(true);
  });

  test("mtime from 40 days ago is still a Recent install", () => {
    expect(isRecentInstall(now - 40 * day, now, 90)).toBe(true);
  });

  test("mtime from 100 days ago is not a Recent install", () => {
    expect(isRecentInstall(now - 100 * day, now, 90)).toBe(false);
  });

  test("Review window days do not change Install age", () => {
    expect(isRecentInstall(now - 40 * day, now, 90)).toBe(true);
    expect(isRecentInstall(now - 40 * day, now, 14)).toBe(false);
  });

  test("config install_age_days overrides the default", () => {
    expect(resolveInstallAgeDays({ config: { install_age_days: 14 } })).toBe(14);
    expect(resolveInstallAgeDays({
      config: { install_age_days: 14, review_window: { max_age_days: 7 } } as { install_age_days: number },
    })).toBe(14);
  });
});

describe("resolveSkillName", () => {
  test("unique Authored name resolves to that Skill", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const dir = writeSkill(cwd, ".claude/skills/ghost", "ghost");
    try {
      const r = resolveSkillName({ name: "ghost", cwd });
      expect(r.status).toBe("unique");
      if (r.status !== "unique") return;
      expect(r.match.dir).toBe(dir);
      expect(r.match.origin).toBe("authored");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("unknown name is none", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    try {
      expect(resolveSkillName({ name: "ghost", cwd }).status).toBe("none");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("same name in two agent roots is ambiguous", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    writeSkill(cwd, ".claude/skills/ghost", "ghost");
    writeSkill(cwd, ".grok/skills/ghost", "ghost");
    try {
      const r = resolveSkillName({ name: "ghost", cwd });
      expect(r.status).toBe("ambiguous");
      if (r.status !== "ambiguous") return;
      expect(r.matches).toHaveLength(2);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("--for claude picks the Claude copy", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const claude = writeSkill(cwd, ".claude/skills/ghost", "ghost");
    writeSkill(cwd, ".grok/skills/ghost", "ghost");
    try {
      const r = resolveSkillName({ name: "ghost", cwd, forAgent: "claude" });
      expect(r.status).toBe("unique");
      if (r.status !== "unique") return;
      expect(r.match.dir).toBe(claude);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("imported match is refused", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    writeSkill(cwd, ".claude/plugins/cache/pkg/ghost", "ghost");
    try {
      const r = resolveSkillName({ name: "ghost", cwd });
      expect(r.status).toBe("imported");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("Authored + Global same name is ambiguous", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const home = mkdtempSync(join(tmpdir(), "dora-home-"));
    writeSkill(cwd, ".claude/skills/ghost", "ghost");
    const globalDir = writeSkill(home, ".claude/skills/ghost", "ghost");
    try {
      const r = resolveSkillName({ name: "ghost", cwd, home });
      expect(r.status).toBe("ambiguous");
      if (r.status !== "ambiguous") return;
      expect(r.matches.some((m) => m.origin === "authored")).toBe(true);
      expect(r.matches.some((m) => m.origin === "global" && m.dir === globalDir)).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("--global selects the Global copy", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const home = mkdtempSync(join(tmpdir(), "dora-home-"));
    writeSkill(cwd, ".claude/skills/ghost", "ghost");
    const globalDir = writeSkill(home, ".claude/skills/ghost", "ghost");
    try {
      const r = resolveSkillName({ name: "ghost", cwd, home, globalOnly: true });
      expect(r.status).toBe("unique");
      if (r.status !== "unique") return;
      expect(r.match.origin).toBe("global");
      expect(r.match.dir).toBe(globalDir);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("path wins over a name clash", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const a = writeSkill(cwd, ".claude/skills/ghost", "ghost");
    writeSkill(cwd, ".grok/skills/ghost", "ghost");
    try {
      const r = resolveSkillName({ name: a, cwd });
      expect(r.status).toBe("unique");
      if (r.status !== "unique") return;
      expect(r.match.dir).toBe(a);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("planRemove + applyRemove", () => {
  test("unique Authored plan deletes the directory", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const dir = writeSkill(cwd, ".claude/skills/ghost", "ghost");
    try {
      const resolved = resolveSkillName({ name: "ghost", cwd });
      const plan = planRemove(resolved);
      expect(plan).toMatchObject({ ok: true, action: "delete", dir, origin: "authored" });
      applyRemove(plan as Extract<typeof plan, { ok: true }>);
      expect(existsSync(dir)).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("Plugin-owned Authored Skill is not a delete plan", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const dir = writeSkill(cwd, "my-plug/skills/inner", "inner");
    mkdirSync(join(cwd, "my-plug", ".claude-plugin"), { recursive: true });
    writeFileSync(join(cwd, "my-plug", ".claude-plugin", "plugin.json"), "{}");
    try {
      const resolved = resolveSkillName({ name: "inner", cwd });
      const plan = planRemove(resolved, cwd);
      expect(plan).toMatchObject({ ok: false, reason: "plugin-owned" });
      if (!plan.ok && plan.reason === "plugin-owned") {
        expect(plan.pluginRoot).toBe(join(cwd, "my-plug"));
      }
      expect(existsSync(dir)).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("imported and ambiguous plans do not delete", () => {
    expect(planRemove({ status: "none" }).ok).toBe(false);
    expect(planRemove({ status: "ambiguous", matches: [] }).ok).toBe(false);
    expect(planRemove({
      status: "imported",
      match: { name: "x", dir: "/x", origin: "imported" },
    }).ok).toBe(false);
  });

  test("unique Global plan Quarantines and Restore puts it back", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const home = mkdtempSync(join(tmpdir(), "dora-home-"));
    const doraHome = mkdtempSync(join(tmpdir(), "dora-qh-"));
    const dir = writeSkill(home, ".claude/skills/ghost", "ghost");
    const prev = process.env.DORAVAL_HOME;
    process.env.DORAVAL_HOME = doraHome;
    try {
      const resolved = resolveSkillName({ name: "ghost", cwd, home });
      const plan = planRemove(resolved);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      expect(plan.action).toBe("quarantine");
      applyRemove(plan);
      expect(existsSync(dir)).toBe(false);
      expect(listQuarantine().some((r) => r.name === "ghost")).toBe(true);
      const back = planRestore("ghost");
      expect(back.ok).toBe(true);
      if (!back.ok) return;
      applyRestore(back);
      expect(existsSync(join(dir, "SKILL.md"))).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.DORAVAL_HOME;
      else process.env.DORAVAL_HOME = prev;
      rmSync(cwd, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
      rmSync(doraHome, { recursive: true, force: true });
    }
  });

  test("Restore refuses an occupied original path", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const home = mkdtempSync(join(tmpdir(), "dora-home-"));
    const doraHome = mkdtempSync(join(tmpdir(), "dora-qh-"));
    const dir = writeSkill(home, ".claude/skills/ghost", "ghost");
    const prev = process.env.DORAVAL_HOME;
    process.env.DORAVAL_HOME = doraHome;
    try {
      applyRemove(planRemove(resolveSkillName({ name: "ghost", cwd, home })) as Extract<ReturnType<typeof planRemove>, { ok: true }>);
      writeSkill(home, ".claude/skills/ghost", "ghost");
      const back = planRestore("ghost");
      expect(back.ok).toBe(false);
      if (back.ok) return;
      expect(back.reason).toBe("occupied");
      expect(existsSync(dir)).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.DORAVAL_HOME;
      else process.env.DORAVAL_HOME = prev;
      rmSync(cwd, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
      rmSync(doraHome, { recursive: true, force: true });
    }
  });

  test("Restore of a Plugin-owned original path is refused", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const doraHome = mkdtempSync(join(tmpdir(), "dora-qh-"));
    const plug = join(cwd, "my-plug");
    const originalPath = join(plug, "skills", "inner");
    mkdirSync(join(plug, ".claude-plugin"), { recursive: true });
    writeFileSync(join(plug, ".claude-plugin", "plugin.json"), "{}");
    const prev = process.env.DORAVAL_HOME;
    process.env.DORAVAL_HOME = doraHome;
    try {
      mkdirSync(join(doraHome, "quarantine", "store"), { recursive: true });
      writeFileSync(join(doraHome, "quarantine", "records.json"), JSON.stringify([{
        name: "inner",
        originalPath,
        storedAt: join(doraHome, "quarantine", "store", "inner"),
        quarantinedAt: new Date().toISOString(),
      }]));
      const back = planRestore({ name: "inner", cwd });
      expect(back.ok).toBe(false);
      if (back.ok) return;
      expect(back.reason).toBe("plugin-owned");
    } finally {
      if (prev === undefined) delete process.env.DORAVAL_HOME;
      else process.env.DORAVAL_HOME = prev;
      rmSync(cwd, { recursive: true, force: true });
      rmSync(doraHome, { recursive: true, force: true });
    }
  });

  test("listRemoveCandidates is Authored, Never invoked, not Recent install", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const old = writeSkill(cwd, ".claude/skills/ghost", "ghost");
    const young = writeSkill(cwd, ".claude/skills/fresh", "fresh");
    writeSkill(cwd, ".grok/skills/other", "other");
    const age = Date.now() / 1000 - 100 * 24 * 60 * 60;
    utimesSync(join(old, "SKILL.md"), age, age);
    utimesSync(young, Date.now() / 1000, Date.now() / 1000);
    const loaded: LoadResult = {
      sessions: [{
        agent: "claude-code", path: "/tmp/s.jsonl", mtime: Date.now(),
        primitives: {
          sessionId: "s1", model: "m", agent: "claude-code", cwd,
          toolCalls: [], toolCallCounts: {}, skillsInvoked: ["other"],
          userMessages: [], userTurnCount: 0, assistantText: [],
        },
      }],
      adaptersDetected: ["claude-code"],
      skipped: {},
    };
    try {
      const cands = listRemoveCandidates({ cwd, loaded });
      expect(cands.map((c) => c.name)).toEqual(["ghost"]);
      const report = listUnusedReport({ cwd, loaded });
      expect(report.candidates.map((c) => c.name)).toEqual(["ghost"]);
      expect(report.recent.map((c) => c.name)).toEqual(["fresh"]);
      expect(report.installAgeDays).toBe(90);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("Global unused lists a home Skill and skips Authored", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const home = mkdtempSync(join(tmpdir(), "dora-home-"));
    writeSkill(cwd, ".claude/skills/local", "local");
    const ghost = writeSkill(home, ".claude/skills/ghost", "ghost");
    const age = Date.now() / 1000 - 100 * 24 * 60 * 60;
    utimesSync(join(ghost, "SKILL.md"), age, age);
    utimesSync(join(cwd, ".claude/skills/local/SKILL.md"), age, age);
    const loaded: LoadResult = {
      sessions: [{
        agent: "claude-code", path: "/tmp/s.jsonl", mtime: Date.now(),
        primitives: {
          sessionId: "s1", model: "m", agent: "claude-code", cwd,
          toolCalls: [], toolCallCounts: {}, skillsInvoked: [],
          userMessages: [], userTurnCount: 0, assistantText: [],
        },
      }],
      adaptersDetected: ["claude-code"],
      skipped: {},
    };
    try {
      const project = listUnusedReport({ cwd, home, loaded, scope: "project" });
      expect(project.candidates.map((c) => c.name)).toEqual(["local"]);
      const global = listUnusedReport({ cwd, home, loaded, scope: "global" });
      expect(global.candidates.map((c) => c.name)).toEqual(["ghost"]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("Plugin-owned Authored Skill is not a Remove candidate", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const old = writeSkill(cwd, ".claude/skills/ghost", "ghost");
    const plugSkill = writeSkill(cwd, "my-plug/skills/inner", "inner");
    mkdirSync(join(cwd, "my-plug", ".claude-plugin"), { recursive: true });
    writeFileSync(join(cwd, "my-plug", ".claude-plugin", "plugin.json"), "{}");
    const age = Date.now() / 1000 - 100 * 24 * 60 * 60;
    utimesSync(join(old, "SKILL.md"), age, age);
    utimesSync(join(plugSkill, "SKILL.md"), age, age);
    const loaded: LoadResult = {
      sessions: [{
        agent: "claude-code", path: "/tmp/s.jsonl", mtime: Date.now(),
        primitives: {
          sessionId: "s1", model: "m", agent: "claude-code", cwd,
          toolCalls: [], toolCallCounts: {}, skillsInvoked: [],
          userMessages: [], userTurnCount: 0, assistantText: [],
        },
      }],
      adaptersDetected: ["claude-code"],
      skipped: {},
    };
    try {
      const cands = listRemoveCandidates({ cwd, loaded });
      expect(cands.map((c) => c.name)).toEqual(["ghost"]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("corrupt records.json does not wipe older entries", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const home = mkdtempSync(join(tmpdir(), "dora-home-"));
    const doraHome = mkdtempSync(join(tmpdir(), "dora-qh-"));
    writeSkill(home, ".claude/skills/ghost", "ghost");
    const prev = process.env.DORAVAL_HOME;
    process.env.DORAVAL_HOME = doraHome;
    try {
      mkdirSync(join(doraHome, "quarantine"), { recursive: true });
      writeFileSync(join(doraHome, "quarantine", "records.json"), "{not-json");
      const dir = join(home, ".claude/skills/ghost");
      expect(() => {
        applyRemove(planRemove(resolveSkillName({ name: "ghost", cwd, home })) as Extract<ReturnType<typeof planRemove>, { ok: true }>);
      }).toThrow();
      expect(existsSync(join(dir, "SKILL.md"))).toBe(true);
      expect(readFileSync(join(doraHome, "quarantine", "records.json"), "utf8")).toBe("{not-json");
    } finally {
      if (prev === undefined) delete process.env.DORAVAL_HOME;
      else process.env.DORAVAL_HOME = prev;
      rmSync(cwd, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
      rmSync(doraHome, { recursive: true, force: true });
    }
  });

  test("two Quarantined Skills with the same name are ambiguous", () => {
    const cwd = mkdtempSync(join(tmpdir(), "dora-rm-"));
    const home = mkdtempSync(join(tmpdir(), "dora-home-"));
    const doraHome = mkdtempSync(join(tmpdir(), "dora-qh-"));
    writeSkill(home, ".claude/skills/ghost", "ghost");
    writeSkill(home, ".grok/skills/ghost", "ghost");
    const prev = process.env.DORAVAL_HOME;
    process.env.DORAVAL_HOME = doraHome;
    try {
      applyRemove(planRemove(resolveSkillName({ name: "ghost", cwd, home, forAgent: "claude" })) as Extract<ReturnType<typeof planRemove>, { ok: true }>);
      applyRemove(planRemove(resolveSkillName({ name: "ghost", cwd, home, forAgent: "grok" })) as Extract<ReturnType<typeof planRemove>, { ok: true }>);
      const clash = planRestore("ghost");
      expect(clash.ok).toBe(false);
      if (clash.ok) return;
      expect(clash.reason).toBe("ambiguous");
      const one = planRestore({ name: "ghost", forAgent: "claude" });
      expect(one.ok).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.DORAVAL_HOME;
      else process.env.DORAVAL_HOME = prev;
      rmSync(cwd, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
      rmSync(doraHome, { recursive: true, force: true });
    }
  });

  test("missing Quarantine name is not ok", () => {
    const doraHome = mkdtempSync(join(tmpdir(), "dora-qh-"));
    const prev = process.env.DORAVAL_HOME;
    process.env.DORAVAL_HOME = doraHome;
    try {
      const back = planRestore("nosuch");
      expect(back.ok).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.DORAVAL_HOME;
      else process.env.DORAVAL_HOME = prev;
      rmSync(doraHome, { recursive: true, force: true });
    }
  });
});
