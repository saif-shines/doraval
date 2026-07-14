import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

let tmpHome: string;
const ORIGINAL_HOME = process.env.DORAVAL_HOME;

beforeEach(() => {
  tmpHome = mkdtempSync(join(tmpdir(), "doraval-migrate-test-"));
  process.env.DORAVAL_HOME = tmpHome;
});

afterEach(() => {
  rmSync(tmpHome, { recursive: true, force: true });
  if (ORIGINAL_HOME) process.env.DORAVAL_HOME = ORIGINAL_HOME;
  else delete process.env.DORAVAL_HOME;
});

function writeJournalFixtures() {
  const journalsDir = join(tmpHome, "journals");
  mkdirSync(journalsDir, { recursive: true });
  writeFileSync(
    join(journalsDir, "global.md"),
    `# Global Journal

## Never use default exports

\`\`\`yaml
pushback: 8
tags: [style, typescript]
author: human
date: 2026-05-01
status: active
\`\`\`

They break re-export ergonomics.

## Corrupt entry with no yaml

Just some prose, no fenced block.
`
  );

  const config = {
    journal: {
      repo: "someone/journal-repo",
      projects: {
        "my-app": {
          remote_path: "projects/my-app.md",
          local_path: join(journalsDir, "my-app.md"),
          source_dir: "/Users/test/code/my-app",
        },
        "orphan-project": {
          remote_path: "projects/orphan-project.md",
          local_path: join(journalsDir, "orphan-project.md"),
        },
      },
    },
  };
  writeFileSync(join(tmpHome, "config.yml"), JSON.stringify(config));

  writeFileSync(
    join(journalsDir, "my-app.md"),
    `# my-app Journal

## Run tests before commit

\`\`\`yaml
pushback: 7
tags: [testing]
author: human
date: 2026-06-01
status: active
\`\`\`

Run tests before commit.
`
  );

  writeFileSync(
    join(journalsDir, "orphan-project.md"),
    `# orphan-project Journal

## Prefer tabs

\`\`\`yaml
pushback: 3
tags: [style]
author: human
date: 2026-06-10
status: active
\`\`\`

Historical preference.
`
  );
}

describe("migrateJournalToMemory", () => {
  test("returns zeroed report when no legacy journal store exists", async () => {
    const { migrateJournalToMemory } = await import("./memory-migrate.js");
    const report = migrateJournalToMemory();
    expect(report.migrated).toBe(0);
    expect(report.droppedCorrupt.length).toBe(0);
  });

  test("migrates global + project entries, maps pushback to weight, drops corrupt with reason", async () => {
    writeJournalFixtures();
    const { migrateJournalToMemory } = await import("./memory-migrate.js");
    const { getGlobalPrinciplesPath, getProjectPrinciplesPath, getProjectSlug } = await import("./memory-config.js");

    const report = migrateJournalToMemory();

    expect(report.migrated).toBe(3);
    expect(report.droppedCorrupt.length).toBe(1);
    expect(report.droppedCorrupt[0]!.reason).toMatch(/YAML/i);

    const globalContent = readFileSync(getGlobalPrinciplesPath(), "utf-8");
    expect(globalContent).toContain("Never use default exports");
    expect(globalContent).toContain("weight: 8");

    const slug = getProjectSlug("/Users/test/code/my-app");
    const projectContent = readFileSync(getProjectPrinciplesPath(slug), "utf-8");
    expect(projectContent).toContain("Run tests before commit");
    expect(projectContent).toContain("weight: 7");

    expect(report.noKnownDirectory).toBe(1);
    expect(globalContent).toContain("Prefer tabs");
    expect(globalContent).toContain("legacy:orphan-project");
  });

  test("is idempotent — second run is a no-op and reports alreadyMigrated", async () => {
    writeJournalFixtures();
    const { migrateJournalToMemory } = await import("./memory-migrate.js");
    const first = migrateJournalToMemory();
    expect(first.migrated).toBe(3);

    const second = migrateJournalToMemory();
    expect(second.alreadyMigrated).toBe(true);
    expect(second.migrated).toBe(0);
  });
});

describe("runJournalMigrationIfNeeded", () => {
  test("returns null when no legacy journals dir exists at all", async () => {
    const { runJournalMigrationIfNeeded } = await import("./memory-migrate.js");
    expect(runJournalMigrationIfNeeded()).toBeNull();
  });

  test("runs once, then returns null on subsequent calls", async () => {
    writeJournalFixtures();
    const { runJournalMigrationIfNeeded } = await import("./memory-migrate.js");
    const first = runJournalMigrationIfNeeded();
    expect(first?.migrated).toBe(3);
    const second = runJournalMigrationIfNeeded();
    expect(second).toBeNull();
  });
});
