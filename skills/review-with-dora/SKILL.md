---
name: review-with-dora
description: >-
  Use when reviewing agent context (SKILL.md, plugin, rule, AGENTS.md) with
  dora before reporting done. Also when ask-dora routes a Dora job (review,
  fix, unused, scan), or the user asks to review, diagnose, or clean up
  Claude, Cursor, Codex, Copilot, or Grok context.
---

# review-with-dora

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

4. **Judgment.** Run Brief. Then **replace**.
   `dora fix <path> --brief` (or `--json`).
   Each item: `message`, `severity`, `hint`, optional `code` / `docUrl`.
   Target is that Authored `SKILL.md`.

   **Replace** one item at a time:
   - Name the intended rule in one sentence. Write the smallest wording that states it.
   - Put that wording where the old sentence lived. One home.
   - Stay inside the span the item names.
   - Imperative. One statement of the rule.
   - Skill already states the rule → show the Finding, leave the file.
   - Stay in this Skill's files. A size Finding may move text into this Skill's `references/`.

   Done: every item replaced or shown. Then step 5.

5. **Re-review.** `dora review --quick <path>` after every edit.
   Done: **exit 0**. That is the only report-done.

6. **Delegated Judge** only after step 5 is **exit 0** and a later Review (no `--quick`) is `delegated`.
   Read `JUDGE THIS`. Evaluate. Fix Findings.
   Done: mechanical tiers clean and the rubric applied.
   Branch on JSON: [output.md](references/output.md).

Add `--format json` when you will branch on fields. Add `--ci` in CI.

## Writes

Pass `--yes` or `--dry-run` on `fix`, `conflicts`, `memory promote`, `skill remove`, `skill restore`, `probe`, `harness new --accept`, `harness apply`, `harness rm`, and `config set` of a secret.
`--brief` is not a write. A missing write flag is **exit 2**.

## Side paths

Verbs: [commands.md](references/commands.md). Exit codes and JSON: [output.md](references/output.md).
Flags: `dora <command> --help`.

- Durable rule → `dora memory add "<rule>" --weight <1-10>` (`≥ 7` is hard). Promote only when the user asks.
- Conflict Finding → `dora conflicts --dry-run`, then ask the user.
- Unused Authored Skill → `dora skill unused`, then `dora skill remove <name> --dry-run`. Home: `dora skill unused --global`.
- Recurring use case → `dora harness new` (starts `ask-dora` / `grilling-for-routine`). Then `dora harness apply <slug>`. `dora harness boot <slug>` is the apply alias. Then `hermes mcp login scalekit`. Runtime watch after apply, boot, list, pause, and resume. Also `dora harness show <slug>`, `dora harness logs <slug>`, `dora harness rm <slug> --yes`, `dora harness pause`, `dora harness resume`, `dora harness list`, `dora harness open`.
- Workspace map → `dora scan --yes`.
- Prove doraval.dev → `dora config set identity.api_key <token> --yes`, then `dora probe --yes`. Never echo the token.

MUST report done only on **exit 0**.
MUST NOT skip Brief for Judgment items.
