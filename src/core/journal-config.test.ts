import { describe, test, expect } from "bun:test";
import { getEvalsDir, getEvalConfig, getDoravalDir, resolveProjectName, type JournalConfig } from "./journal-config.js";
import { join } from "path";

describe("getEvalsDir", () => {
  test("returns evals/ under doraval dir", () => {
    const result = getEvalsDir();
    expect(result).toBe(join(getDoravalDir(), "evals"));
  });
});

describe("getEvalConfig", () => {
  test("returns defaults when config is null", () => {
    const result = getEvalConfig(null);
    expect(result.max_tool_calls).toBe(200);
    expect(result.save_history).toBe(true);
    expect(result.model).toBe("");
  });

  test("returns values from config when present", () => {
    const config = {
      journal: { repo: "test/repo", projects: {} },
      eval: { model: "glm-5-turbo", max_tool_calls: 300, save_history: false, judge: 'api' },
    };
    const result = getEvalConfig(config);
    expect(result.model).toBe("glm-5-turbo");
    expect(result.max_tool_calls).toBe(300);
    expect(result.save_history).toBe(false);
    expect(result.judge).toBe('api');
  });
});

describe("resolveProjectName", () => {
  test("returns null when config is null", () => {
    expect(resolveProjectName(null, "/Users/dev/api")).toBeNull();
  });

  test("matches by source_dir, not by guessing basename against the key", () => {
    // Registered under a custom name ("work-api") that does NOT match the
    // directory's basename ("api") — the old basename-guess would fail here.
    const config: JournalConfig = {
      journal: {
        repo: "me/journal",
        projects: {
          "work-api": { remote_path: "projects/work-api.md", local_path: "/x", source_dir: "/Users/dev/co-a/api" },
        },
      },
    };
    expect(resolveProjectName(config, "/Users/dev/co-a/api")).toBe("work-api");
  });

  test("does not collide when two projects share a basename but differ in source_dir", () => {
    const config: JournalConfig = {
      journal: {
        repo: "me/journal",
        projects: {
          api: { remote_path: "projects/api.md", local_path: "/x", source_dir: "/Users/dev/work/api" },
          "api-personal": { remote_path: "projects/api-personal.md", local_path: "/y", source_dir: "/Users/dev/personal/api" },
        },
      },
    };
    expect(resolveProjectName(config, "/Users/dev/work/api")).toBe("api");
    expect(resolveProjectName(config, "/Users/dev/personal/api")).toBe("api-personal");
  });

  test("falls back to legacy basename guess for entries with no source_dir", () => {
    const config: JournalConfig = {
      journal: {
        repo: "me/journal",
        projects: { api: { remote_path: "projects/api.md", local_path: "/x" } },
      },
    };
    expect(resolveProjectName(config, "/Users/dev/api")).toBe("api");
  });

  test("returns null when no source_dir matches and basename guess also misses", () => {
    const config: JournalConfig = {
      journal: {
        repo: "me/journal",
        projects: { api: { remote_path: "projects/api.md", local_path: "/x", source_dir: "/Users/dev/work/api" } },
      },
    };
    expect(resolveProjectName(config, "/Users/dev/other-dir")).toBeNull();
  });
});
