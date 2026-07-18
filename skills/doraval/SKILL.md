---
name: doraval
description: "Verify agent context with the `dora` CLI before calling it done. Use whenever you create, edit, or review a skill (SKILL.md), plugin, rule, agent config (CLAUDE.md / AGENTS.md / .cursor/rules / copilot-instructions), or project memory. Also use when the user asks to check, fix, diagnose, or clean up agent context across Claude, Cursor, Codex, Copilot, or Grok."
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
| Entering a repo with agent context you didn't write | `dora` (bare = scan) |
| Just wrote or edited any `SKILL.md`, rule, or plugin | `dora review <path>` |
| Review reported mechanical errors | `dora fix <path> --dry-run`, then `dora fix <path>` |
| Learned a durable rule the user wants enforced | `dora memory add "<rule>" --weight <1-10>` |
| Two agents disagree on a convention | `dora reconcile` |
| CI or subagent (non-interactive) | add `--ci` (implies `--format json`) |

## The loop — never skip the gate

1. **Scan first.** Run `dora`. Read what surfaces exist, which skills are
   healthy, what contradicts. State what you found before authoring anything.
2. **Author** the skill / rule / plugin.
3. **Review.** `dora review <path>`. Read the exit code.
   **Do not tell the user the work is done while the exit code is `1` or `2`.**
4. **Fix.** `dora fix <path> --dry-run` to preview, then `dora fix <path>`.
   `fix` shows a diff and asks before writing — let it. Don't hand-patch what
   `fix` owns.
5. **Remember.** Durable decisions go to `dora memory add`, not a code comment.

## Rules of engagement

- **Exit code is truth.** `2` means the tool could not run — say so and why;
  never report a pass you didn't get.
- **Branch on JSON, not prose.** When you need to act on results, use
  `--format json` and read `.summary` (`passed` / `warnings` / `failed`) and
  `.contradictions`. See [`references/output.md`](references/output.md).
- **Non-interactive** (CI, subagents): add `--ci`; add `--yes` only where a
  write is intended, `--dry-run` where it is not.
- **`dora` not found?** Run it with no install: `npx @hacksmith/doraval`.
  (macOS: `brew install doraval`.)
- Full command + flag reference: [`references/commands.md`](references/commands.md).

## What dora does not do

It does not write your skill for you or invent passing results. It diagnoses,
applies mechanical fixes, and remembers decisions. Judgement fixes come back as
a brief (`dora fix --brief`) for you to act on.
