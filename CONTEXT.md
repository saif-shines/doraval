# Doraval — domain context

Agent-readable glossary for architecture and code. Product language wins over legacy file names.

## Product

**Doraval** (`dora` / `doraval`) is a context-engineering CLI: scan, review, and manage agent skills, memory files, and rules across Claude, Cursor, Codex, Copilot, and Grok.

## Core terms

| Term | Meaning |
|------|---------|
| **Skill** | A directory with `SKILL.md` (frontmatter + body) that agents load as specialized instructions. |
| **Review** | Tiered quality pass over a skill or memory file: structure → heuristics → optional LLM judge → optional sessions. |
| **Scan** | Fast workspace health check (`dora` bare): agents present, skill validation, shadows/overlaps, install/intelligence. |
| **Rule** | Stable coded check identity (`R001`…`R033`) with slug, default severity, tier, and optional `locked` flag. Users toggle via packages/overrides. |
| **Package** | Named enable-set of rules: `recommended` (default), `strict`, `minimal`. |
| **Judge** | LLM path that scores skill/memory quality. Modes: **api** (direct credentials), **delegate** (emit prompt for the calling agent), **fail** (no judge, e.g. `--ci` without a key). |
| **Memory** | Product term for principles, artifacts, and always-on files (`AGENTS.md`, `CLAUDE.md`, …) under `~/.doraval/memory/` and project roots. |
| **Config** | Global product config at `~/.doraval/config.yml`. Code type is still `JournalConfig` (legacy name — not a “journal product”). Holds projects, `eval.*` judge settings, rules, agent command. |
| **Session** | Past agent conversation transcript, normalized via **session adapters** into primitives for evidence and adherence eval. |
| **Finding** | One check outcome (severity + message + optional rule code / docUrl). Review and scan both produce findings; public rule codes are preferred. |

## Naming debt (intentional)

- **`JournalConfig` / `journal:`** — historical. Prefer saying **config** in docs and new code comments. Full rename is not required for correctness.
- **`E-VAL-*` / `E-SCAN-*`** — older scan/error codes. New mechanical skill issues should stamp **rule codes** (`R0xx`) where a binding exists.
- **`agent-invoke`** — CLI agent spawn for skill exercise / prompt-gen. **Not** the judge path (judge is API or delegate only).

## Architecture vocabulary

When designing modules: **module**, **interface**, **depth**, **seam**, **adapter**, **leverage**, **locality** (see codebase-design skill). Prefer one deep module per product concept (especially **Judge**).
