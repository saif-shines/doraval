import { defineCommand } from "citty";
import { resolve } from "path";
import { existsSync, readFileSync, appendFileSync } from "fs";
import { generateUlid, serializeEntry, type MemoryEntry } from "../../../core/memory-parse.js";
import { getProjectSlug, getProjectPrinciplesPath, getGlobalPrinciplesPath, ensureMemoryDirs } from "../../../core/memory-config.js";
import { runJournalMigrationIfNeeded } from "../../../core/memory-migrate.js";
import { reportMigration } from "./migration-report.js";
import { ui, summaryLine } from "../../out.js";
import { exit } from "../../render/exit.js";

/** Cold-start examples for --help / empty states (B40). */
export const MEMORY_EXAMPLE_PRINCIPLES = [
  "Never use default exports",
  "Run bun test before commit",
  "Prefer named exports",
] as const;

export const MEMORY_WEIGHT_GUIDE = "w8 = hard rule · w5 = default · w3 = soft preference";

export default defineCommand({
  meta: {
    name: "add",
    description: "Add a principle to project memory (local, instant)",
  },
  args: {
    title: {
      type: "positional",
      description: `Short imperative title (≤ 80 chars). e.g. "${MEMORY_EXAMPLE_PRINCIPLES[0]}"`,
      required: true,
    },
    weight: {
      type: "string",
      description: `Importance 1–10 (default 5). ${MEMORY_WEIGHT_GUIDE}`,
      default: "5",
    },
    tags: { type: "string", description: "Comma-separated tags" },
    global: { type: "boolean", description: "Add to global memory (shared across projects)", default: false },
    body: { type: "string", description: "Rationale or detail" },
  },
  async run({ args }) {
    reportMigration(runJournalMigrationIfNeeded());

    const title = String(args.title);
    if (title.length > 80) {
      ui.fail("Title must be ≤ 80 characters");
      await exit(1);
      return;
    }

    const weight = parseInt(String(args.weight), 10);
    if (isNaN(weight) || weight < 1 || weight > 10) {
      ui.fail("Weight must be an integer 1–10");
      await exit(1);
      return;
    }

    const tags = args.tags ? String(args.tags).split(",").map(t => t.trim()).filter(Boolean) : [];
    const body = args.body ? String(args.body) : "";
    const isGlobal = args.global as boolean;

    const cwd = process.cwd();
    const slug = getProjectSlug(cwd);
    ensureMemoryDirs(isGlobal ? undefined : slug);

    const entry: MemoryEntry = {
      id: generateUlid(),
      title,
      weight,
      tags,
      date: new Date().toISOString().slice(0, 10),
      status: "active",
      body,
    };

    // Determine target file
    const targetPath = isGlobal
      ? getGlobalPrinciplesPath()
      : getProjectPrinciplesPath(slug);

    // Ensure parent dir
    const parentDir = resolve(targetPath, "..");
    if (!existsSync(parentDir)) {
      const { mkdirSync } = await import("fs");
      mkdirSync(parentDir, { recursive: true });
    }

    // Append (create if missing)
    const serialized = serializeEntry(entry);
    const prefix = existsSync(targetPath) ? "\n" : "";
    appendFileSync(targetPath, prefix + serialized, "utf-8");

    ui.blank();
    ui.success(`Added to ${isGlobal ? "global" : "project"} memory: "${title}"`);
    summaryLine(`id: ${entry.id} · weight: ${weight} · ${isGlobal ? "global" : slug}`);
    ui.blank();

    await exit(0);
  },
});
