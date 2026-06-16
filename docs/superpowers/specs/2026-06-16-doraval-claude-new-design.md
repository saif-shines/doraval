# Design: `doraval claude new` — User-Driven Wizard for Standalone vs. Plugin Paths

**Date:** 2026-06-16  
**Status:** Sections approved in brainstorming; consolidated here for review  
**Related:** Option B command hierarchy; end-user-driven decision pattern (now in AGENTS.md)

## Problem / Goal

Doraval needs to help two distinct audiences when working with Claude Code artifacts:

- Personal customizers who want short names and simple `.claude/` setups for their own projects or quick experiments.
- Distributors who need proper packaged plugins (with `.claude-plugin/plugin.json` manifest and namespaced commands like `/plugin-name:hello`) for sharing, versioning, or community use.

Users often start in "self now" mode but may want to distribute later. The official Claude Code table (standalone vs. plugins) should drive decisions, but users should not be forced to know the packaging terminology upfront.

The solution is a smart, context-aware entry point: `doraval claude new`. It detects the user's current reality (directory, existing files like loose `SKILL.md`, `.claude/`, or `.claude-plugin/`), asks concise intent questions framed around the official table, proposes smart defaults, lets the user confirm or adjust, and scaffolds the minimal correct structure.

This end-user-driven approach (context detection → intent questions → defaults → confirm → scaffold) is now the primary pattern for interactive tools in the project (documented in AGENTS.md).

## Command Hierarchy (Option B)

```
doraval
├── validate          # Universal checker (already spans both)
├── skill             # Universal atomic skill authoring (kept prominent)
├── claude            # Namespace for Claude Code packaging rules
│   └── new           # The smart, guiding wizard (primary creation entry)
├── init / journal    # Unchanged
```

Under `claude`, official terms like "plugin" and "marketplace" are acceptable and discoverable.

`doraval claude new` is the friendly front door. It can later expose direct sub-paths (e.g. `doraval claude plugin new`) for power users, but the wizard is the recommended starting point.

## User Workflows & Intent Paths

Three common mindsets (framed from the user's perspective, not internal jargon):

1. **"Mainly for myself / this project right now"** — Standalone path (`.claude/` + short names like `/my-skill`).
2. **"For myself now, but I might want to share or publish it later"** — The thoughtful middle path (most common per official docs; start simple but prepare for conversion).
3. **"Planning to share with teammates or distribute more widely"** — Plugin path (manifest + namespaced commands).

The wizard surfaces the official table (Standalone vs. Plugins) in plain language during questioning.

## Context Detection (First Step)

Before or during questions, `doraval claude new` inspects:

- Current working directory contents.
- Presence of `.claude/`, `.claude-plugin/plugin.json`, loose `SKILL.md`, `skills/`, `commands/`, `agents/`, project markers (e.g. `.git`, `package.json`).
- Whether the location is a fresh/empty dir, an existing project root, or a subdirectory.

Key rule (approved):
- Loose `SKILL.md` detected + no formal `.claude/` + intent "self now but might distribute later" → defaults to (b) creating a new sibling plugin directory.

Other cases adapt the recommendation (enhance in place, create sibling, add to existing plugin, etc.).

## Interactive Flow & Prompts (Concise)

1. Detect context.
2. Ask 1–2 intent questions (framed around the official table).
3. Propose default based on detection + answers.
4. Let user confirm or choose alternative.
5. Scaffold minimal correct artifacts.
6. Print short outcome (command names, test instructions, `doraval validate .` suggestion).

Example high-level flow (text kept concise; exact wording can be tightened later):

```
$ doraval claude new

I see you’re in a project directory that already contains a SKILL.md (but no .claude/ or .claude-plugin/ folder).

Are you mainly:
  1. Building this for yourself / this project right now
  2. For yourself now, but you might want to share or publish it later
  3. Planning to share with teammates or distribute more widely

> 2

I found loose SKILL.md files here with no formal .claude/ structure yet.

Because you answered “self now, but might distribute later”, the default is to create a new sibling directory with the full plugin structure (`.claude-plugin/plugin.json` + namespaced commands).

I can still do the lightweight `.claude/` version instead if you prefer.

Defaulting to: create `my-helper-plugin/` as a plugin.

Proceed with default (y) or choose the other option (a)? >
```

Non-interactive fallback:
- `doraval claude new --yes --intent self-later --name my-helper`
- Same detection + default logic; skips prompts.

## Scaffolding Artifacts (Minimal Wiring)

Only the smallest viable structure for the chosen path. Leaves existing user files untouched unless user explicitly confirms migration.

**Standalone path** (personal/short names):
- `.claude/skills/<name>/SKILL.md` (basic frontmatter with `name` + `description`; short imperative body starter).
- Light `.claude/` wrapper if nothing existed.

**Plugin path** (sharing/namespaced):
- `<name>/.claude-plugin/plugin.json` (minimal: `name`, `description`, `version: "0.1.0"`).
- `<name>/skills/<kebab>/SKILL.md` (basic frontmatter + short body).
- `<name>/README.md` (one-paragraph stub).

**Special case** (loose `SKILL.md` + "self now + later" → default sibling plugin):
- New sibling dir as above.
- New `SKILL.md` starts minimal (or pulls content from detected loose file as optional "migrate this content?" step).
- Original loose `SKILL.md` left in place.

In all cases the wizard clearly states the resulting command name(s) (`/my-skill` vs. `/my-plugin:my-skill`) and test steps.

## Outcome Messaging & Next Steps

Always ends with a short, actionable block:
- Resulting command name(s).
- How to test (e.g. `claude --plugin-dir ./my-helper-plugin` or normal use for standalone).
- `doraval validate .` recommendation.
- Clear pointer to conversion later if the user chose a "might distribute later" path (`doraval claude plugin convert`).

## Alignment with Project Principles

- End-user-driven decisions are the primary pattern (see new section in AGENTS.md).
- Reuses existing `doraval validate` and `skill` surfaces.
- Stays inside Option B hierarchy (`claude` namespace for Claude-specific packaging).
- Supports the official "start standalone, convert when ready" story without forcing users to know the table upfront.
- Concise wizard text by default; exact prompts can be refined in implementation.

## Open Items (for implementation)

- Exact prompt wording and help text (can be tightened).
- Full details of `doraval claude plugin convert` surface (separate but related).
- Optional migration step UX when pulling loose `SKILL.md` content.
- Shell completions and `--help` examples for the new command.
- Any additional edge cases discovered during implementation.

---

This design consolidates all approved sections from the brainstorming session. It is intentionally scoped to the `doraval claude new` wizard and its immediate supporting logic.
