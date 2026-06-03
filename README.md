# doraval

Lint and measure drift for AI agent skills and plugins.

Works with any agent following the [Agent Skills spec](https://agentskills.io/specification) — Grok, Claude Code, Cursor, Windsurf, and others.

## Features

- **Structural validation** — Verify frontmatter, required fields, and file layout
- **Rubric drift detection** — Measure deviation across trigger phrases, voice, examples, guardrails, and clarity
- **AI-driven judging** — Qualitative skill assessment via LLM *(coming soon)*
- **CI-friendly** — JSON output and non-zero exit codes for pipeline integration
- **Fast** — Deterministic checks run locally with zero network calls

## Installation

Requires [Bun](https://bun.sh) v1.2+.

```bash
bun install -g doraval
```

Or run directly:

```bash
bunx doraval skill validate ./my-skill
```

> [!NOTE]
> doraval is also published on [JSR](https://jsr.io/@hacksmith/doraval) as `@hacksmith/doraval`.

## Usage

```
doraval skill <command> <path> [options]
```

### `skill validate` — Structural checks

Verify that a skill directory has valid YAML frontmatter, required fields (`name`, `description`), a non-empty body, and expected sub-directories.

```bash
doraval skill validate ./skills/my-skill/
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
doraval skill drift ./skills/my-skill/
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
doraval skill judge ./skills/my-skill/
```

## Options

All `skill` subcommands accept these flags:

| Flag | Short | Description |
|---|---|---|
| `--format <type>` | `-f` | Output format: `table` (default) or `json` |
| `--agent <name>` | `-a` | Force a specific agent adapter |
| `--verbose` | `-v` | Show detailed diagnostics |
| `--ci` | | Machine-friendly output, non-zero exit on issues |

### CI/CD integration

Use `--format json` and `--ci` for pipeline-friendly output:

```bash
doraval skill validate ./my-skill/ --format json --ci
doraval skill drift ./my-skill/ --format json --ci
```

`validate` exits with code `1` when errors are found. Both commands write structured JSON to stdout when `--format json` is set — pipe it to `jq` or consume it programmatically.

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
