---
name: doraval
description: >-
  Review agent context (SKILL.md, plugin, rule, AGENTS.md) with dora before
  reporting done. Also when the user asks to review, diagnose, or clean up
  Claude, Cursor, Codex, Copilot, or Grok context.
---

# doraval

You run `dora`. **Review** is the gate. Done means **exit 0**.

If `dora` is not on `PATH`, use `npx @hacksmith/doraval`.

## The loop

1. **Review.** `dora review --quick` on a new repo. After an edit, `dora review --quick <path>`.
   `<path>` is the Skill directory, a plugin root, or `.`.
   More than 10 artifacts: pass a path or `--all`.
   Done: Findings read, exit code read. **exit 0** is the only report-done.

2. **Author** only when the user asked you to write a Skill, Rule, agent, or plugin.
   `dora skill new` / `dora rule new` / `dora agent new` / `dora plugin new`.
   Done: the files exist.

3. **Mechanical fix.**
   ```bash
   dora fix <path> --dry-run
   dora fix <path> --yes
   ```
   `--yes` applies frontmatter, formatting, and missing fields.
   Done: dry-run is clean, or `--yes` applied.

4. **Judgment.** Do not skip.
   `dora fix <path> --brief` (or `--json`).
   Each item has `message`, `severity`, `hint`, and optional `code` / `docUrl`.
   Edit that Authored `SKILL.md`. Then step 5.
   Done: every item edited.

   When you edit:
   - State the intended rule in one sentence. Then make the smallest change.
   - Replace text. Do not append another paragraph.
   - Change only what the Brief item names. Leave the rest.
   - Do not add hedging or extra examples from this one run.
   - If the Skill already required the right behavior, do not thicken it. Show the Finding to the user and stop.
   - Do not create a new Skill. Do not move text to `references/` unless a size Finding names that.
   - Authored only. Do not edit Global or Imported.

5. **Re-review.** `dora review --quick <path>` after every edit.
   Done: **exit 0**.

6. **Delegated Judge** only after step 5 is **exit 0** and a later Review (no `--quick`) is `delegated`.
   Read `JUDGE THIS`. Evaluate. Fix Findings.
   Done: mechanical tiers clean and the rubric applied.
   Branch on JSON: [output.md](references/output.md).

Add `--format json` when you will branch on fields. Add `--ci` in CI.

## Writes

Pass `--yes` or `--dry-run` on `fix`, `conflicts`, `memory promote`, `skill remove`, and `skill restore`.
`--brief` is not a write. A missing write flag is **exit 2**.

## Side paths

Verbs: [commands.md](references/commands.md). Exit codes and JSON: [output.md](references/output.md).
Flags: `dora <command> --help`. Map: `dora --help --json`.

- User states a durable rule → `dora memory add "<rule>" --weight <1-10>` (`≥ 7` is hard). Promote only when the user asks.
- Review or Scan reports a conflict → `dora conflicts --dry-run`, then ask the user.
- R034 / unused Authored Skill → `dora skill unused`, then `dora skill remove <name> --dry-run`. Home Skills: `dora skill unused --global`. A Plugin row or `removable: false` → `dora review --quick <plugin-root>`. An Owned child with `removable: true` may be removed. Unused writes nothing.
- Workspace map (not the first job) → `dora scan --yes`.

Empty `dora` is `--help`. Scan is `dora scan`.
