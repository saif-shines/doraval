# doraval

The context engineering toolkit for coding agents.

Validate skills, plugins, hooks, MCP configs, and memory files across providers — locally or from a Git URL. Works with Claude Code today; Cursor, Codex, and Windsurf coming next.

## Features

- **Pluggable validators** — Auto-detect and validate skills, plugins, marketplaces, hooks, MCP config, subagents, commands, and memory files
- **Multi-provider** — Claude Code validators built in; Cursor, Codex, Windsurf planned
- **Remote validation** — Point at a GitHub URL instead of cloning first
- **Rubric drift detection** — Measure deviation across trigger phrases, voice, examples, guardrails, and clarity
- **AI-driven judging** — Qualitative skill assessment via LLM *(coming soon)*
- **CI-friendly** — JSON output and non-zero exit codes for pipeline integration

## Installation

Requires [Bun](https://bun.sh) v1.2+.

```bash
bun install -g doraval
```

Or run directly:

```bash
bunx doraval validate .
```

> [!NOTE]
> doraval is also published on [JSR](https://jsr.io/@hacksmith/doraval) as `@hacksmith/doraval`.

## Usage

### `validate` — Auto-detect and validate

The main command. Point it at a local directory or a Git URL, and it auto-detects what validators apply.

```bash
dora validate .                                    # local directory
dora validate https://github.com/obra/superpowers  # remote repo
dora validate https://github.com/obra/superpowers/tree/main/skills/brainstorming  # subdirectory
```

Filter by provider or specific validator with `--for`:

```bash
dora validate . --for claude          # all Claude validators that match
dora validate . --for claude:plugin   # just the plugin validator
```

#### Available validators (Claude)

| Validator | Detects | What it checks |
|---|---|---|
| `claude:skill` | `SKILL.md` | Frontmatter (relaxed name/desc; recommended + directory-derived command), body, supporting files, dynamic injection, substitutions, advanced fields (allowed-tools, context, etc.) |
| `claude:plugin` | `.claude-plugin/plugin.json` | Manifest fields, component paths, skill/command/agent dirs |
| `claude:marketplace` | `plugins/` with plugin subdirs | Plugin directory structure, README, LICENSE |
| `claude:hooks` | `hooks/hooks.json` or `hooks.json` | Valid JSON, known event names |
| `claude:mcp` | `.mcp.json` | Valid JSON, server definitions |
| `claude:subagent` | `agents/*.md` | Frontmatter with description, non-empty body |
| `claude:command` | `commands/*.md` | Frontmatter with description, non-empty body |
| `claude:memory` | `CLAUDE.md` | Non-empty, length limit, @path import resolution |

#### Remote URLs

`dora validate` accepts GitHub URLs (and any Git URL). It clones the repo to a temp directory, validates, and cleans up. For GitHub repos, it tries `gh` first (handles private repos via your existing auth), then falls back to `git clone`.

Supported URL forms:

```bash
dora validate https://github.com/owner/repo
dora validate https://github.com/owner/repo/tree/branch
dora validate https://github.com/owner/repo/tree/main/sub/dir
dora validate github.com/owner/repo                          # shorthand
```

### `skill validate` — Structural checks (single skill)

Validate a single skill directory. This is the original command and continues to work unchanged.

```bash
dora skill validate ./skills/my-skill/
```

```
  doraval skill validate — Structural validation

  Path:  ./skills/my-skill/

  ✓ YAML frontmatter present and parseable
  ✓ name: "my-skill"
  ✓ description field present
  ✓ Markdown body is non-empty
  ✓ references/ directory exists

  Result: 0 error(s), 0 warning(s)
```

### `skill drift` — Rubric deviation

Measure how far a skill has drifted from known-good rubric standards. Each check maps to a drift category:

| Category | What it checks |
|---|---|
| **Trigger** | Description includes activation phrases (`Use when...`) |
| **Structure** | Body has numbered steps or checklists |
| **Voice** | Uses imperative language (`Create`, `Run`, `Ensure`) |
| **Example** | Contains code blocks |
| **Guardrail** | Has explicit `MUST` / `MUST NOT` constraints |
| **Clarity** | Free of ambiguous words (`maybe`, `perhaps`, `consider`) |

```bash
dora skill drift ./skills/my-skill/
```

```
  doraval skill drift — Measuring rubric drift

  Path:  ./skills/my-skill/

  · Trigger    Description includes activation phrases
  · Structure  Has step-by-step instructions
  · Voice      Uses imperative voice ("Do X" not "You might X")
  ↗ Example    No code blocks found — add examples if the skill involves code
  ↗ Guardrail  No explicit constraints — add MUST / MUST NOT guardrails
  · Clarity    No ambiguous language found

  2/6 rubric areas have drifted.
```

### `skill judge` — AI-driven assessment

> [!WARNING]
> Not yet implemented. This command will send the skill to an LLM for qualitative review of clarity, completeness, and effectiveness.

```bash
dora skill judge ./skills/my-skill/
```

## Options

| Flag | Short | Description |
|---|---|---|
| `--format <type>` | `-f` | Output format: `table` (default) or `json` |
| `--for <spec>` | | Target a provider (`claude`) or specific validator (`claude:plugin`) |
| `--verbose` | `-v` | Show detailed diagnostics |
| `--ci` | | Machine-friendly output, non-zero exit on issues |

### CI/CD integration

Use `--format json` and `--ci` for pipeline-friendly output:

```bash
dora validate . --for claude --format json --ci
dora skill validate ./my-skill/ --format json --ci
dora skill drift ./my-skill/ --format json --ci
```

`validate` exits with code `1` when errors are found. Commands write structured JSON to stdout when `--format json` is set — pipe it to `jq` or consume it programmatically.

## `journal` — Decision memory with pushback

Record, view, and sync project principles and decisions so that future you (and agents) don't accidentally contradict past choices.

The journal lives in a private GitHub repo you control (by convention `yourname/yourname.md`). All config and cache lives under `~/.doraval/`.

```bash
dora init                     # Recommended: set up journal + the coding agent dora will use on the fly for rich `add`
dora journal list             # View active principles
dora journal update           # Pull latest from the remote into local cache
dora journal add "..."        # Propose a decision/note (or long rich markdown via --raw-markdown); staged locally; uses configured agent when input is minimal
dora journal sync             # Publish pending entries + refresh cache
```

`update` is the recommended way to keep your local mirror fresh (e.g. at the start of a session or before `skill drift`).

Requires the GitHub CLI (`gh`) for talking to the remote journal repo.

See the docs site for full details and rationale.
