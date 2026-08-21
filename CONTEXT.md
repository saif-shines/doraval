# Doraval — domain context

Agent-readable glossary for architecture and code. Product language wins over legacy file names.

## Product

**Doraval** (`dora` / `doraval`) is a context-effectiveness CLI: scan, review, and manage agent skills, memory files, and rules across Claude, Cursor, Codex, Copilot, and Grok.

## Core terms

| Term | Meaning |
|------|---------|
| **Skill** | A directory with `SKILL.md` (frontmatter + body) that agents load as specialized instructions. |
| **Authored** | Skill origin: a Skill under the current project. |
| **Global** | Skill origin: a Skill under the user home (for example `~/.claude/skills`). |
| **Imported** | Skill origin: a Skill from plugin cache or `node_modules`. Read-only. Not a remove target. |
| **Review** | One `review(path)`. Tiered quality pass over a Skill and/or Memory file: structure → heuristics → optional LLM judge → optional sessions. Workspace and Skill reviews also include cwd Memory files (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `copilot-instructions.md`). |
| **Scan** | Fast workspace health check (`dora` bare): agents present, skill validation, shadows/overlaps, install/intelligence. |
| **Rule** | One module (`src/core/rules`). Registry, packages, resolve, stamp, and mutation. CLI only renders and writes config. |
| **Package** | Named enable-set of rules: `recommended` (default), `strict`, `minimal`. |
| **Judge** | One module (`judge()`). Owns mode (**api** / **delegate** / **fail**) and transport. Review passes prompt, schema, and `ci`. |
| **Memory** | Product term for principles, artifacts, and always-on files (`AGENTS.md`, `CLAUDE.md`, …) under `~/.doraval/memory/` and project roots. |
| **Config** | Global product config at `~/.doraval/config.yml`. Code type is still `JournalConfig` (legacy name — not a “journal product”). Holds projects, `eval.*` judge settings, rules, agent command. |
| **Session** | Past agent conversation transcript, normalized via **session adapters** into primitives for evidence and adherence eval. |
| **Finding** | One Skill-check outcome (tier + severity + message + optional rule code / docUrl). The Skill-check module sets `structure` or `heuristics`. Review adds `llm` and `sessions`. Scan presents Skill Findings as health; shadows, overlaps, MCP, budget, and install stay Scan-only. |
| **Review window** | Session evidence span Review already uses: last 10 Sessions, and only Session files newer than 30 days. |
| **Never invoked** | A Skill with no invoke evidence in Sessions inside the Review window. Not the same as a remove candidate. |
| **Recent install** | A Skill added inside the current Review window (`dora new`, `skills add`, copy, or clone). Never invoked is expected. Not a remove candidate. |
| **Remove candidate** | An Authored Skill that is Never invoked and not a Recent install. Its own Finding (new rule). Not R029. Review and Scan may recommend remove. A Global Skill is never a Remove candidate from one project’s Sessions. |
| **Quarantine** | Move a Global Skill aside so it can be restored. Not a delete. _Avoid_: stash. |
| **Remove** | Write action (`dora skill remove`). Deletes an Authored Skill. Quarantines a Global Skill. A name is enough. `--for` selects the agent. `--global` selects origin when Authored and Global share a name. One match: just Remove. Several matches (including same agent, two origins): TTY picker; a Runner must pass `--for` / `--global` / a path or it exits `2` with Next. |
| **Restore** | Write action (`dora skill restore`). Puts a Quarantined Global Skill back at its original path (`~/.doraval/quarantine/` plus a record). Does not undo an Authored delete. Git does that. If the original path is occupied, stop. |
| **Explicit remove** | A named Remove. Works on any Authored or Global Skill. Does not require Remove-candidate status. Refuses Imported. |

## Docs voice

Two addressees. Do not mix them on one surface.

| Term | Meaning |
|------|---------|
| **Reader** | The human. “you” on README, install, and `get-started`. |
| **Runner** | The agent that executes `dora`. “you” on the skill, on `dora --help`, and on per-command `--help`. |

The website is mixed. Do not mix the two voices on one page.

**`--help` voice:** top-level `dora --help` talks to the **Runner** (the agent), same as per-command `--help`. README, install, and `get-started` stay **Reader**. See `docs/adr/0001-help-talks-to-runner.md`.

**First loop:** `npx skills add saif-shines/doraval`, then `dora review --quick` so findings show before JSON, LLM, or CI flags. The same two lines open README Quick start **and** `dora --help`.

**README:** Reader surface. Follows the agent-browser README shape (install → quick start → long pasteable command catalog).

**Site catalog:** Same long catalog as the README. Path follows agent-browser (they use `/commands` for this page). The skill still does not copy a flag encyclopedia.

**This pass** is lockstep, not a docs rewrite. The binary (`dora --help`, per-command `--help`, unknown-command, `dora agent-help`) is the work. README and `/commands` change only when a new help line would disagree with them.

**agent-help:** The live command map for agents. Bare prints text. `dora agent-help --json` is the same tree. `dora agent-help review` drills into one verb. Each verb is labeled **read-only** or **writes**. `--capabilities` is removed. See `docs/adr/0004-agent-help.md` and `docs/adr/0005-drop-capabilities.md`.

**`--json`:** Alias for `--format json`. Both work. `--ci` still implies JSON. Errors stay on stderr.

**This pass is done when:** `dora --help` names the same first Review as the README (`dora review --quick`); `dora agent-help` exists and `--capabilities` is gone; per-command `--help` for review / fix / scan shows examples; `dora nosuch` prints one error and `Next: dora --help` (no help dump); `--json` works; agent scan skips the proceed gate; agent writes without `--yes`/`--dry-run` exit `2`; **and** README / `/commands` still agree with those lines.

Grill for this pass is settled (2026-08-20). Next: `/to-spec`, then tickets. Do not implement from this glossary alone.

**`llms.txt`:** generated from the site. Fix the pages. Do not hand-write a second index.

_Avoid_: one “you” for both on a **Reader** page; an agent page that still talks to a human (“use with your agent”); leading with `--format json` before a `--quick` review. Top-level `--help` is allowed to say “for agents.”

**Interactive gate:** A TTY confirm before work. A human on a real terminal still sees it. A caller we treat as an agent does not. Detection is an env/TTY rule, not a new flag. See `docs/adr/0002-agent-skips-scan-prompt.md`.

**Write gate:** `fix`, `reconcile`, and `memory promote` write files. A detected agent that omits `--yes` / `--dry-run` gets exit `2` and a Next line. No prompt. No write. See `docs/adr/0003-agent-write-needs-flag.md`.

## Naming debt (intentional)

- **`JournalConfig` / `journal:`** — historical. Prefer saying **config** in docs and new code comments. Full rename is not required for correctness.
- **`E-VAL-*` / `E-SCAN-*`** — older scan/error codes. New mechanical skill issues should stamp **rule codes** (`R0xx`) where a binding exists.
- **`agent-invoke`** — CLI agent spawn for skill exercise / prompt-gen. **Not** the judge path (judge is API or delegate only).

## Architecture vocabulary

When designing modules: **module**, **interface**, **depth**, **seam**, **adapter**, **leverage**, **locality** (see codebase-design skill). Prefer one deep module per product concept (especially **Judge**).
