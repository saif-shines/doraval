# Doraval — domain context

Agent-readable glossary for architecture and code. Product language wins over legacy file names.

## Product

**Doraval** (`dora` / `doraval`) is a context-engineering CLI: scan, review, and manage agent skills, memory files, and rules across Claude, Cursor, Codex, Copilot, and Grok.

## Core terms

| Term | Meaning |
|------|---------|
| **Skill** | A directory with `SKILL.md` (frontmatter + body) that agents load as specialized instructions. |
| **Review** | One `review(path)`. Tiered quality pass over a Skill and/or Memory file: structure → heuristics → optional LLM judge → optional sessions. Workspace and Skill reviews also include cwd Memory files (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `copilot-instructions.md`). |
| **Scan** | Fast workspace health check (`dora` bare): agents present, skill validation, shadows/overlaps, install/intelligence. |
| **Rule** | One module (`src/core/rules`). Registry, packages, resolve, stamp, and mutation. CLI only renders and writes config. |
| **Package** | Named enable-set of rules: `recommended` (default), `strict`, `minimal`. |
| **Judge** | One module (`judge()`). Owns mode (**api** / **delegate** / **fail**) and transport. Review passes prompt, schema, and `ci`. |
| **Memory** | Product term for principles, artifacts, and always-on files (`AGENTS.md`, `CLAUDE.md`, …) under `~/.doraval/memory/` and project roots. |
| **Config** | Global product config at `~/.doraval/config.yml`. Code type is still `JournalConfig` (legacy name — not a “journal product”). Holds projects, `eval.*` judge settings, rules, agent command. |
| **Session** | Past agent conversation transcript, normalized via **session adapters** into primitives for evidence and adherence eval. |
| **Finding** | One Skill-check outcome (tier + severity + message + optional rule code / docUrl). The Skill-check module sets `structure` or `heuristics`. Review adds `llm` and `sessions`. Scan presents Skill Findings as health; shadows, overlaps, MCP, budget, and install stay Scan-only. |

## Docs voice

Two addressees. Do not mix them on one surface.

| Term | Meaning |
|------|---------|
| **Reader** | The human. “you” on README, install, and `get-started`. |
| **Runner** | The agent that executes `dora`. “you” on the skill and on per-command `--help`. |

The website is mixed. Do not mix the two voices on one page.

**`--help` voice:** top-level / most-common help talks to the **Reader**. Per-command help (`dora review --help`, and the rest) talks to the **Runner**.

**First loop:** `npx skills add saif-shines/doraval`, then `dora review --quick` so findings show before JSON, LLM, or CI flags.

**README:** Reader surface. Follows the agent-browser README shape (install → quick start → long pasteable command catalog).

**Site catalog:** Same long catalog as the README. Path follows agent-browser (they use `/commands` for this page). The skill still does not copy a flag encyclopedia.

**This pass is done when:** every in-scope surface uses the new voice and the first loop; home + README use the agent-browser shape; `/for-agents/` is gone; `#4-review-quality` still works; **and** a Reader can finish one real `--quick` review from the README alone.

**`llms.txt`:** generated from the site. Fix the pages. Do not hand-write a second index.

_Avoid_: one “you” for both; an agent page that still talks to a human (“use with your agent”); leading with `--format json` before a `--quick` review.

## Naming debt (intentional)

- **`JournalConfig` / `journal:`** — historical. Prefer saying **config** in docs and new code comments. Full rename is not required for correctness.
- **`E-VAL-*` / `E-SCAN-*`** — older scan/error codes. New mechanical skill issues should stamp **rule codes** (`R0xx`) where a binding exists.
- **`agent-invoke`** — CLI agent spawn for skill exercise / prompt-gen. **Not** the judge path (judge is API or delegate only).

## Architecture vocabulary

When designing modules: **module**, **interface**, **depth**, **seam**, **adapter**, **leverage**, **locality** (see codebase-design skill). Prefer one deep module per product concept (especially **Judge**).
