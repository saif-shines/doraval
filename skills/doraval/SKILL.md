---
name: doraval
description: "Verify agent-context quality with the `dora` CLI. Whenever you author or edit a skill (SKILL.md), plugin, rule, or agent config, run dora to check it before reporting the work done. Also use when the user asks to check, diagnose, fix, or clean up agent context across Claude, Cursor, Codex, Copilot, or Grok. Not for ordinary source-code edits."
---

# doraval

You run `dora`. It is the verification gate on agent context: Skills, Rules, plugins, and Memory files.

Treat the exit code as truth. Do not report done while the code is `1` or `2`.

If `dora` is not on `PATH`, run `npx @hacksmith/doraval` in its place.

## Exit codes

| Code | Meaning | Action |
| --- | --- | --- |
| `0` | clean | Only then report done |
| `1` | issues found | Fix or surface to the user. Do not report done |
| `2` | could not run | Report the failure and why. Do not claim a pass |

`--deep` Review exits `2` when no Judge is available. That is "could not run the tier you required," not clean.

## First Review

Surface Findings before JSON, LLM, or CI flags:

```bash
dora review --quick
```

`--quick` is structure + heuristics. No Judge. No LLM wait.

After you edit one artifact, pass its path:

```bash
dora review --quick <path>
```

`<path>` is the Skill directory (the folder that holds `SKILL.md`), a plugin root, or `.` for the workspace.

If Review finds more than 10 artifacts, it may ask how many to grade. Pass a path or `--all` so it does not prompt.

## Then JSON

Add `--format json` when you will branch on fields, not on a table:

```bash
dora review --quick --format json
```

In CI or a non-interactive subagent, add `--ci` (implies `--format json`).

Require the Judge only after a `--quick` pass is clean:

```bash
dora review --deep <path>
```

`--deep` exits `2` if no Judge is available. JSON keys and how to branch: [`references/output.md`](references/output.md).

## The loop

The gate is Review. Do not skip it.

1. **Review.** Run `dora review --quick` (or `dora review --quick <path>` after an edit). Read Findings. Read the exit code. Do not report done on `1` or `2`.
2. **Author** the Skill, Rule, or plugin if the user asked you to write one.
3. **Fix mechanical issues.** Preview, then apply without a TTY prompt:

   ```bash
   dora fix <path> --dry-run
   dora fix <path> --yes
   ```

   `--yes` applies only mechanical fixes (frontmatter, formatting, missing fields). Never run bare `dora fix`. A detected agent exits `2`. A human TTY is asked.
4. **Judgement fixes.** Anything `--yes` cannot apply comes from `dora fix <path> --brief`. Hand-edit those. Do not wait for `--yes` to do judgement work.
5. **Re-verify.** After every fix or hand-edit, run `dora review --quick <path>` again. The gate is passed only when the exit code is `0`.
6. **Delegated Judge.** If a later Review (without `--quick`) shows LLM as `via delegated` (JSON `method: "delegated"`), dora handed you the rubric. Read the `JUDGE THIS` prompt. Evaluate the Skill against it. Fix findings before you report done. Done means mechanical tiers are clean and delegated judgment is complete.
7. **Memory — only with user intent.** When the user states a durable rule to enforce:

   ```bash
   dora memory add "<rule>" --weight <1-10>
   ```

   Weight is priority (1–10, default 5). `≥ 7` is a hard rule (enforced in Review). Do not invent memories from your own inferences.

   To write hard rules into `AGENTS.md`, run `dora memory promote --dry-run`, then `dora memory promote --yes` only when the user wants that. Never run bare `promote`. It prompts.
8. **Contradictions.** If Review or Scan reports a cross-agent conflict, run `dora reconcile --dry-run` and ask the user. Never run bare `reconcile`. Use `--apply` only after the user confirms.

## When to reach for each verb

| Moment | Command |
| --- | --- |
| Entering a repo with agent context you did not write | `dora review --quick` |
| Just wrote or edited a Skill, Rule, or plugin | `dora review --quick <path>` |
| Branch on fields | add `--format json` |
| CI / non-interactive subagent | add `--ci` |
| Mechanical errors in Findings | `dora fix <path> --dry-run`, then `--yes` |
| User states a durable rule | `dora memory add "<rule>" --weight <1-10>` |
| Two agents disagree | `dora reconcile --dry-run`, then ask the user |
| Fast workspace check (no Review) | `dora --yes` (bare Scan; `--yes` skips the TTY confirm) |

## Constraints

You run in a loop that cannot answer TTY prompts.

- MUST treat the exit code as truth: `0` clean, `1` issues, `2` could not run. MUST NOT report done on `1` or `2`.
- MUST run `dora review --quick` first so Findings show before `--format json`.
- MUST apply `fix`, `memory promote`, `skill remove`, and `skill restore` with `--yes` or `--dry-run`. MUST NOT run bare `dora fix`, `dora reconcile`, `dora memory promote`, `dora skill remove`, or `dora skill restore`.
- MUST NOT write to `dora memory` from your own inference. Add a memory only when the user states a durable rule.
- MUST add `--ci` in CI or a non-interactive subagent.
- MUST look up flags with `dora <command> --help`. MUST NOT copy a flag catalog into this skill.

Bare Scan (`dora`) asks a human on a TTY. A detected agent skips that gate. Use `dora --yes` or `dora --json` if you want no prompt. Live command map: `dora agent-help` (add `--json` to parse). Short verb list: [`references/commands.md`](references/commands.md).

## What dora does not do

dora does not write the Skill for you. It does not invent a pass. It diagnoses, applies mechanical fixes (`--yes`), and records user-stated decisions. Judgement fixes come back as a brief (`dora fix --brief`).
