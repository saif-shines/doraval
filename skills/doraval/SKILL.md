---
name: doraval
description: "Verify agent-context quality with the `dora` CLI. Use when you author or edit a skill (SKILL.md), plugin, rule, or agent config and need to check it before reporting done — and when the user asks to check, diagnose, fix, or clean up agent context across Claude, Cursor, Codex, Copilot, or Grok. Not for ordinary source-code edits."
---

# doraval

`dora` reads a repo and reports what's broken in agent context — dead skills,
frontmatter errors, cross-agent contradictions, lost decisions. It is a
**verification gate**: the tool checks your work, so you don't ship context that
fails on the first try.

Every result is verifiable — `dora` exits `0` clean, `1` issues found, `2`
could not run. Treat the exit code as ground truth, not your own judgement.

## When to reach for dora

| Moment | Command |
| --- | --- |
| Entering a repo with agent context you didn't write | `dora --format json` (bare = scan) |
| Just wrote or edited any `SKILL.md`, rule, or plugin | `dora review <path> --format json` |
| Review reported mechanical errors | `dora fix <path> --dry-run`, then `dora fix <path> --yes` |
| User states a durable rule they want enforced | `dora memory add "<rule>" --weight <1-10>` |
| Two agents disagree on a convention | `dora reconcile --dry-run` (then surface to user) |
| CI or subagent (non-interactive) | add `--ci` (implies `--format json`) |

## The loop — never skip the gate

Always pass `--format json` when you will act on the result, so you branch on
data, not on a human-formatted table. `<path>` throughout is the skill
directory (the folder holding `SKILL.md`), a plugin root, or `.` for the whole
repo.

**Two entry points.** If the user asked you to *author* something new, start at
step 1 (scan first). If you were invoked *after already editing* an artifact,
skip to step 3 (review the path you touched) — you don't need a full repo scan
to verify one file.

1. **Scan first.** Run `dora --format json` and read `.summary` /
   `.contradictions`. State what you found before authoring anything.
2. **Author** the skill / rule / plugin.
3. **Review.** `dora review <path> --format json`. Read the exit code.
   **Do not tell the user the work is done while the exit code is `1` or `2`.**
4. **Fix.** Preview first, then apply non-interactively:

   ```bash
   dora fix <path> --dry-run          # show the diff, write nothing
   dora fix <path> --yes              # apply the mechanical fixes
   ```

   You run inside an agent loop that cannot answer TTY prompts — **always use
   `--yes` to apply**, never the bare interactive form (it hangs). `--yes`
   applies **only mechanical fixes** (frontmatter, formatting, missing fields).
5. **Judgement fixes** — anything `fix` can't do mechanically comes back from
   `dora fix <path> --brief` as a prompt. You hand-edit those. **Mechanical =
   what `--yes` applies; judgement = what `--brief` describes.** Don't hand-edit
   the mechanical set, don't wait for `--yes` to do the judgement set.
6. **Re-verify.** After any fix or hand-edit, re-run
   `dora review <path> --format json` and confirm exit `0` before reporting
   done. The gate is only passed when the tool says so.
7. **Remember — only with user intent.** When the user states a durable rule
   they want enforced, record it: `dora memory add "<rule>" --weight <1-10>`.
   Weight is priority (1-10, default 5): `w8` = hard rule, `w5` = default,
   `w3` = soft preference. Weight `≥ 7` is treated as a hard constraint. To
   write those into AGENTS.md, run `dora memory promote --dry-run` to show the
   diff, then `dora memory promote --yes` — only when the user wants hard rules
   enforced repo-wide (never run bare `promote`; it prompts). Do not invent
   memories from your own inferences.

## Rules of engagement

- **MUST** treat the exit code as truth: `0` clean, `1` issues, `2` could not
  run. **MUST NOT** report a pass you didn't get; on `2`, say the tool could not
  run and why.
- **MUST** apply fixes with `--yes` (non-interactive); **MUST NOT** use the
  bare interactive `dora fix` inside an agent loop — it blocks on a prompt.
  Same for `dora reconcile`: use `--dry-run` to read the plan, then surface
  conflicts to the user — never run bare `reconcile` (it prompts and hangs).
- **MUST NOT** write to `dora memory` from your own inference — only on an
  explicit user rule.
- **MUST** add `--ci` in CI / subagent contexts (implies `--format json`,
  strict exit codes).
- **`dora` not found?** Run it with no install: `npx @hacksmith/doraval`.
  (macOS: `brew install doraval`.)
- Full command + flag reference: [`references/commands.md`](references/commands.md).
  Output shape + JSON keys: [`references/output.md`](references/output.md).

## What dora does not do

It does not write your skill for you or invent passing results. It diagnoses,
applies mechanical fixes (`--yes`), and records user-stated decisions. Judgement
fixes come back as a brief (`dora fix --brief`) for you to act on.
