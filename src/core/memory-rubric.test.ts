import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { loadPrinciples, buildPrincipleRubric, checkPrinciplesAgainstContent, type Principle } from "./memory-rubric.js";
import { serializeEntry, type MemoryEntry } from "./memory-parse.js";
import { getProjectSlug } from "./memory-config.js";

// ── Helpers ────────────────────────────────────────────────────────

let tempDir: string;
let originalHome: string | undefined;

function makePrinciple(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: "01J7KXPG9QABCDEF01234567",
    title: "Use imperative titles",
    weight: 7,
    tags: ["naming"],
    date: "2026-07-01",
    status: "active",
    body: "Keeps entries scannable.",
    ...overrides,
  };
}

beforeEach(() => {
  originalHome = process.env.DORAVAL_HOME;
  tempDir = join(tmpdir(), `doraval-rubric-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(tempDir, { recursive: true });
  process.env.DORAVAL_HOME = tempDir;
});

afterEach(() => {
  if (originalHome === undefined) {
    delete process.env.DORAVAL_HOME;
  } else {
    process.env.DORAVAL_HOME = originalHome;
  }
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// ── loadPrinciples ─────────────────────────────────────────────────

describe("loadPrinciples", () => {
  test("returns empty array when no files exist", () => {
    const result = loadPrinciples("/some/nonexistent/project");
    expect(result).toEqual([]);
  });

  test("loads global principles from principles.md file", () => {
    const globalDir = join(tempDir, "memory", "repo", "global");
    mkdirSync(globalDir, { recursive: true });

    const entry = makePrinciple({ id: "GLOB0000000000000000000000", title: "Prefer named exports" });
    writeFileSync(join(globalDir, "principles.md"), serializeEntry(entry), "utf-8");

    const result = loadPrinciples("/some/project");
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("GLOB0000000000000000000000");
    expect(result[0]!.title).toBe("Prefer named exports");
    expect(result[0]!.source).toBe("global");
  });

  test("loads project-scoped principles", () => {
    const cwd = "/Users/dev/my-project";
    const slug = getProjectSlug(cwd);
    const projectDir = join(tempDir, "memory", "repo", "projects", slug);
    mkdirSync(projectDir, { recursive: true });

    const entry = makePrinciple({ id: "PROJ0000000000000000000000", title: "Always add tests" });
    writeFileSync(join(projectDir, "principles.md"), serializeEntry(entry), "utf-8");

    const result = loadPrinciples(cwd);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("PROJ0000000000000000000000");
    expect(result[0]!.title).toBe("Always add tests");
    expect(result[0]!.source).toBe("project");
  });

  test("filters out non-active entries (superseded/retired)", () => {
    const globalDir = join(tempDir, "memory", "repo", "global");
    mkdirSync(globalDir, { recursive: true });

    const active = makePrinciple({ id: "ACTV0000000000000000000000", title: "Active rule", status: "active" });
    const superseded = makePrinciple({ id: "SUPR0000000000000000000000", title: "Old rule", status: "superseded" });
    const retired = makePrinciple({ id: "RETD0000000000000000000000", title: "Retired rule", status: "retired" });

    const content = [serializeEntry(active), "", serializeEntry(superseded), "", serializeEntry(retired)].join("\n");
    writeFileSync(join(globalDir, "principles.md"), content, "utf-8");

    const result = loadPrinciples("/some/project");
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("ACTV0000000000000000000000");
    expect(result[0]!.title).toBe("Active rule");
  });

  test("merges global + project principles", () => {
    const cwd = "/Users/dev/my-project";
    const slug = getProjectSlug(cwd);

    // Global
    const globalDir = join(tempDir, "memory", "repo", "global");
    mkdirSync(globalDir, { recursive: true });
    const globalEntry = makePrinciple({ id: "GLOB0000000000000000000000", title: "Global rule" });
    writeFileSync(join(globalDir, "principles.md"), serializeEntry(globalEntry), "utf-8");

    // Project
    const projectDir = join(tempDir, "memory", "repo", "projects", slug);
    mkdirSync(projectDir, { recursive: true });
    const projectEntry = makePrinciple({ id: "PROJ0000000000000000000000", title: "Project rule", weight: 5 });
    writeFileSync(join(projectDir, "principles.md"), serializeEntry(projectEntry), "utf-8");

    const result = loadPrinciples(cwd);
    expect(result).toHaveLength(2);
    expect(result[0]!.source).toBe("global");
    expect(result[0]!.title).toBe("Global rule");
    expect(result[1]!.source).toBe("project");
    expect(result[1]!.title).toBe("Project rule");
  });
});

// ── buildPrincipleRubric ───────────────────────────────────────────

describe("buildPrincipleRubric", () => {
  test("returns empty string for no principles", () => {
    expect(buildPrincipleRubric([])).toBe("");
  });

  test("formats MUST for weight >= 7, SHOULD for < 7", () => {
    const principles: Principle[] = [
      { ...makePrinciple({ weight: 9, title: "Critical rule" }), source: "global" },
      { ...makePrinciple({ weight: 7, title: "Important rule" }), source: "global" },
      { ...makePrinciple({ weight: 5, title: "Nice to have" }), source: "project" },
      { ...makePrinciple({ weight: 3, title: "Suggestion only" }), source: "project" },
    ];

    const rubric = buildPrincipleRubric(principles);

    expect(rubric).toContain("## Project Principles (from dora memory)");
    expect(rubric).toContain("- MUST: Critical rule (weight 9)");
    expect(rubric).toContain("- MUST: Important rule (weight 7)");
    expect(rubric).toContain("- SHOULD: Nice to have (weight 5)");
    expect(rubric).toContain("- SHOULD: Suggestion only (weight 3)");
  });

  test("includes body as context when present", () => {
    const principles: Principle[] = [
      { ...makePrinciple({ weight: 8, title: "Always test", body: "Prevents regressions" }), source: "global" },
    ];

    const rubric = buildPrincipleRubric(principles);
    expect(rubric).toContain("Context: Prevents regressions");
  });
});

// ── checkPrinciplesAgainstContent ──────────────────────────────────

describe("checkPrinciplesAgainstContent", () => {
  test("detects violation of negative principle", () => {
    const principles: Principle[] = [
      {
        ...makePrinciple({ title: "Never use default exports", weight: 8 }),
        source: "project",
      },
    ];

    const content = "export default function main() { return 42; }";
    const results = checkPrinciplesAgainstContent(principles, content);

    expect(results).toHaveLength(1);
    expect(results[0]!.violated).toBe(true);
    expect(results[0]!.detail).toContain("keyword match found");
    expect(results[0]!.principle.title).toBe("Never use default exports");
  });

  test("returns empty for non-negative principles (conservative)", () => {
    const principles: Principle[] = [
      {
        ...makePrinciple({ title: "Prefer named exports", weight: 6 }),
        source: "global",
      },
    ];

    const content = "export default function main() { return 42; }";
    const results = checkPrinciplesAgainstContent(principles, content);

    // Conservative: non-negative principles don't trigger tier 2 violations
    expect(results).toHaveLength(0);
  });

  test("no violation when banned keywords not found in content", () => {
    const principles: Principle[] = [
      {
        ...makePrinciple({ title: "Avoid console.log statements", weight: 5 }),
        source: "project",
      },
    ];

    const content = "const logger = createLogger('app');\nlogger.info('started');";
    const results = checkPrinciplesAgainstContent(principles, content);

    expect(results).toHaveLength(0);
  });
});
