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
| **Rule** | Stable coded check identity (`R001`…`R033`) with slug, default severity, tier, and optional `locked` flag. Users toggle via packages/overrides. |
| **Package** | Named enable-set of rules: `recommended` (default), `strict`, `minimal`. |
| **Judge** | One module (`judge()`). Owns mode (**api** / **delegate** / **fail**) and transport. Review passes prompt, schema, and `ci`. |
| **Memory** | Product term for principles, artifacts, and always-on files (`AGENTS.md`, `CLAUDE.md`, …) under `~/.doraval/memory/` and project roots. |
| **Config** | Global product config at `~/.doraval/config.yml`. Code type is still `JournalConfig` (legacy name — not a “journal product”). Holds projects, `eval.*` judge settings, rules, agent command. |
| **Session** | Past agent conversation transcript, normalized via **session adapters** into primitives for evidence and adherence eval. |
| **Finding** | One Skill-check outcome (tier + severity + message + optional rule code / docUrl). The Skill-check module sets `structure` or `heuristics`. Review adds `llm` and `sessions`. Scan presents Skill Findings as health; shadows, overlaps, MCP, budget, and install stay Scan-only. |

## Naming debt (intentional)

- **`JournalConfig` / `journal:`** — historical. Prefer saying **config** in docs and new code comments. Full rename is not required for correctness.
- **`E-VAL-*` / `E-SCAN-*`** — older scan/error codes. New mechanical skill issues should stamp **rule codes** (`R0xx`) where a binding exists.
- **`agent-invoke`** — CLI agent spawn for skill exercise / prompt-gen. **Not** the judge path (judge is API or delegate only).

## Architecture vocabulary

When designing modules: **module**, **interface**, **depth**, **seam**, **adapter**, **leverage**, **locality** (see codebase-design skill). Prefer one deep module per product concept (especially **Judge**).
