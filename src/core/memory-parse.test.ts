import { describe, expect, test } from "bun:test";
import {
  parseMemoryEntries,
  serializeEntry,
  generateUlid,
  type MemoryEntry,
} from "./memory-parse.js";

// ── Helpers ────────────────────────────────────────────────────────

function makeValidBlock(overrides: Record<string, unknown> = {}, opts?: { title?: string; body?: string }): string {
  const title = opts?.title ?? "Use imperative titles";
  const body = opts?.body ?? "This keeps entries scannable and consistent.";
  const meta = {
    id: "01J7KXPG9QABCDEF01234567",
    weight: 7,
    tags: ["naming", "cli"],
    date: "2026-07-01",
    status: "active",
    ...overrides,
  };
  const yamlLines = Object.entries(meta)
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: [${v.join(", ")}]`;
      return `${k}: ${v}`;
    })
    .join("\n");
  return `## ${title}\n\n\`\`\`yaml\n${yamlLines}\n\`\`\`\n\n${body}`;
}

// ── Tests ──────────────────────────────────────────────────────────

describe("parseMemoryEntries", () => {
  test("parses a valid v2 entry", () => {
    const raw = makeValidBlock();
    const { entries, errors } = parseMemoryEntries(raw);
    expect(errors).toHaveLength(0);
    expect(entries).toHaveLength(1);
    const e = entries[0]!;
    expect(e.id).toBe("01J7KXPG9QABCDEF01234567");
    expect(e.title).toBe("Use imperative titles");
    expect(e.weight).toBe(7);
    expect(e.tags).toEqual(["naming", "cli"]);
    expect(e.date).toBe("2026-07-01");
    expect(e.status).toBe("active");
    expect(e.body).toContain("scannable");
  });

  test("parses multiple entries", () => {
    const raw = [
      makeValidBlock({ id: "AAAA0000000000000000000000" }, { title: "First principle" }),
      "",
      makeValidBlock(
        { id: "BBBB0000000000000000000000", weight: 3, status: "superseded" },
        { title: "Second principle", body: "Replaced by a better approach." },
      ),
    ].join("\n");
    const { entries, errors } = parseMemoryEntries(raw);
    expect(errors).toHaveLength(0);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.title).toBe("First principle");
    expect(entries[1]!.title).toBe("Second principle");
    expect(entries[1]!.status).toBe("superseded");
  });

  test("rejects entry with missing id", () => {
    const raw = makeValidBlock({ id: undefined });
    // Remove the id line entirely
    const cleaned = raw.replace(/^id:.*\n/m, "");
    const { entries, errors } = parseMemoryEntries(cleaned);
    expect(entries).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.reason).toContain("id");
  });

  test("rejects entry with missing weight", () => {
    const raw = makeValidBlock({ weight: undefined });
    const cleaned = raw.replace(/^weight:.*\n/m, "");
    const { entries, errors } = parseMemoryEntries(cleaned);
    expect(entries).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.reason).toContain("weight");
  });

  test("rejects entry with title > 80 chars", () => {
    const longTitle = "A".repeat(81);
    const raw = makeValidBlock({}, { title: longTitle });
    const { entries, errors } = parseMemoryEntries(raw);
    expect(entries).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.reason).toContain("80");
  });

  test("rejects entry with weight out of range", () => {
    const rawHigh = makeValidBlock({ weight: 11 });
    const { entries: e1, errors: err1 } = parseMemoryEntries(rawHigh);
    expect(e1).toHaveLength(0);
    expect(err1).toHaveLength(1);
    expect(err1[0]!.reason).toContain("weight");

    const rawZero = makeValidBlock({ weight: 0 });
    const { entries: e2, errors: err2 } = parseMemoryEntries(rawZero);
    expect(e2).toHaveLength(0);
    expect(err2).toHaveLength(1);
    expect(err2[0]!.reason).toContain("weight");
  });

  test("rejects entry with bad status", () => {
    const raw = makeValidBlock({ status: "archived" });
    const { entries, errors } = parseMemoryEntries(raw);
    expect(entries).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.reason).toContain("archived");
  });

  test("rejects entry with missing date", () => {
    const raw = makeValidBlock({ date: undefined });
    const cleaned = raw.replace(/^date:.*\n/m, "");
    const { entries, errors } = parseMemoryEntries(cleaned);
    expect(entries).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.reason).toContain("date");
  });

  test("valid entries pass and invalid entries go to errors (mixed)", () => {
    const good = makeValidBlock(
      { id: "GOOD0000000000000000000000" },
      { title: "Good entry" },
    );
    const bad = makeValidBlock(
      { id: undefined },
      { title: "Bad entry" },
    ).replace(/^id:.*\n/m, "");
    const alsoGood = makeValidBlock(
      { id: "ALSO0000000000000000000000", weight: 2 },
      { title: "Also good" },
    );
    const raw = [good, "", bad, "", alsoGood].join("\n");
    const { entries, errors } = parseMemoryEntries(raw);
    expect(entries).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(entries[0]!.title).toBe("Good entry");
    expect(entries[1]!.title).toBe("Also good");
    expect(errors[0]!.title).toBe("Bad entry");
  });

  test("empty input returns empty arrays", () => {
    const { entries, errors } = parseMemoryEntries("");
    expect(entries).toHaveLength(0);
    expect(errors).toHaveLength(0);

    const { entries: e2, errors: err2 } = parseMemoryEntries("   \n\n  ");
    expect(e2).toHaveLength(0);
    expect(err2).toHaveLength(0);
  });
});

describe("serializeEntry", () => {
  test("round-trips correctly", () => {
    const entry: MemoryEntry = {
      id: "01J7KXPG9QABCDEF01234567",
      title: "Always use imperative mood",
      weight: 8,
      tags: ["style", "docs"],
      date: "2026-07-01",
      status: "active",
      body: "Imperative mood keeps entries actionable and scannable.",
    };

    const serialized = serializeEntry(entry);

    // Must start with ## heading
    expect(serialized).toMatch(/^## Always use imperative mood/);
    // Must contain yaml fence
    expect(serialized).toContain("```yaml");
    // Must contain all required fields in block-style YAML
    expect(serialized).toContain("id: 01J7KXPG9QABCDEF01234567");
    expect(serialized).toContain("weight: 8");
    expect(serialized).toContain("date: 2026-07-01");
    expect(serialized).toContain("status: active");
    // Must contain body
    expect(serialized).toContain("Imperative mood keeps entries actionable");

    // Parse it back and verify
    const { entries, errors } = parseMemoryEntries(serialized);
    expect(errors).toHaveLength(0);
    expect(entries).toHaveLength(1);
    const parsed = entries[0]!;
    expect(parsed.id).toBe(entry.id);
    expect(parsed.title).toBe(entry.title);
    expect(parsed.weight).toBe(entry.weight);
    expect(parsed.date).toBe(entry.date);
    expect(parsed.status).toBe(entry.status);
    expect(parsed.body).toContain("actionable");
  });
});

describe("generateUlid", () => {
  test("returns 26-char string", () => {
    const ulid = generateUlid();
    expect(ulid).toHaveLength(26);
  });

  test("contains only Crockford Base32 characters", () => {
    const ulid = generateUlid();
    expect(ulid).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  test("successive calls produce different values", () => {
    const a = generateUlid();
    const b = generateUlid();
    // Extremely unlikely to collide given 80 bits of randomness
    expect(a).not.toBe(b);
  });
});
