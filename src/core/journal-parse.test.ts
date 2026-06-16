import { describe, expect, test } from "bun:test";
import { parseJournalEntries, parseJournalEntriesWithWarnings } from "./journal-parse.js";

describe("parseJournalEntries", () => {
  test("parses a single well-formed entry", () => {
    const raw = `
# My Journal

## Use "drift" not "score"

\`\`\`yaml
pushback: 7
tags: [naming, cli]
author: human
date: 2026-05-25
status: active
\`\`\`

We renamed score to drift because "score" implies a generic quality rating.
`;

    const entries = parseJournalEntries(raw);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.title).toBe('Use "drift" not "score"');
    expect(entries[0]!.pushback).toBe(7);
    expect(entries[0]!.tags).toEqual(["naming", "cli"]);
    expect(entries[0]!.status).toBe("active");
    expect(entries[0]!.rationale).toContain("We renamed score to drift");
  });

  test("parses multiple entries", () => {
    const raw = `
## First decision

\`\`\`yaml
pushback: 5
tags: [architecture]
author: human
date: 2026-05-20
status: active
\`\`\`

Rationale for first.

## Second decision

\`\`\`yaml
pushback: 9
tags: [testing, cli]
author: agent:grok
date: 2026-05-22
status: superseded
superseded_by: Use better testing approach
\`\`\`

Rationale for second.
`;

    const entries = parseJournalEntries(raw);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.title).toBe("First decision");
    expect(entries[1]!.title).toBe("Second decision");
    expect(entries[1]!.status).toBe("superseded");
    expect(entries[1]!.superseded_by).toBe("Use better testing approach");
  });

  test("is lenient with malformed entries (skips them but continues)", () => {
    const raw = `
## Good entry

\`\`\`yaml
pushback: 4
tags: [docs]
author: human
date: 2026-05-25
status: active
\`\`\`

Good rationale.

## Bad entry - no yaml

Some text without proper metadata.

## Another good one

\`\`\`yaml
pushback: 2
tags: [ux]
author: human
date: 2026-05-26
status: active
\`\`\`

Second good rationale.
`;

    const { entries, warnings } = parseJournalEntriesWithWarnings(raw);
    expect(entries).toHaveLength(2);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(w => w.includes("Bad entry - no yaml"))).toBe(true);
  });

  test("handles missing optional fields gracefully", () => {
    const raw = `
## Minimal entry

\`\`\`yaml
pushback: 3
tags: [naming]
author: agent:claude
date: 2026-05-27
status: active
\`\`\`

Minimal rationale.
`;

    const entries = parseJournalEntries(raw);
    expect(entries[0]!.superseded_by).toBeUndefined();
  });

  test("returns empty array for empty or header-only content", () => {
    expect(parseJournalEntries("# Just a header\n\nNo entries here.")).toEqual([]);
    expect(parseJournalEntries("")).toEqual([]);
  });

  test("extracts rationale after the YAML fence correctly", () => {
    const raw = `
## Title

\`\`\`yaml
pushback: 6
tags: [cli]
author: human
date: 2026-05-28
status: active
\`\`\`

This is the rationale.

It can have multiple paragraphs.

- And lists
`;

    const entries = parseJournalEntries(raw);
    expect(entries[0]!.rationale).toContain("This is the rationale.");
    expect(entries[0]!.rationale).toContain("And lists");
  });
});
