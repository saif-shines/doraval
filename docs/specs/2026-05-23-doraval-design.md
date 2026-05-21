# doraval — Skill & Plugin Validation CLI for Coding Agents

**Date:** 2026-05-23
**Status:** Draft
**Author:** Saif

---

## Overview

doraval is a CLI tool that validates, scores, and tests skills and plugins for AI coding agents. It supports any agent following the Agent Skills spec (Claude Code, Cursor, Windsurf, Grok, and others). It serves both skill/plugin authors (validating work before publishing) and consumers (auditing quality before trusting).

The name combines "Dora" (Doraemon) with "val" (validate/eval).

## Goals

1. **Structural validation** — verify YAML frontmatter, file structure, manifests, referenced files
2. **Quality scoring** — rate description quality, trigger coverage, instruction clarity, anti-patterns
3. **Multi-agent support** — adapter-based architecture for Claude Code, Grok, Cursor, Windsurf, and any future agent
4. **Component-aware** — validate all parts of a plugin: skills, commands, agents, hooks, MCP servers, rules files
5. **Extensible** — open component type registry; new component types and agent adapters without touching core

### Future Goals (v0.2+)

6. **Rubric-based eval** — authors define test prompts + expected behaviors; doraval runs sessions and grades them
7. **Drift detection** — analyze agent session transcripts for trigger accuracy, instruction adherence, scope containment
8. **Session execution** — run headless agent sessions programmatically for ~30s, inspect model traces
9. **Issue reporting** — consumers report quality issues back to skill/plugin owners via GitHub issues

## Non-Goals (v0.1)

- Runtime session execution (v0.3)
- Drift detection from transcripts (v0.3)
- Issue reporting to authors (v0.3)
- Interactive prompts / guided mode
- GUI or web interface

## Architecture

### Adapter-Plugin Architecture

A core validation engine with per-agent adapters. Each adapter knows how to detect, parse, and validate skills/plugins for its agent. The core engine operates on a normalized Package model.

```
doraval/
├── src/
│   ├── cli/                      # CLI layer
│   │   ├── index.ts              # entry point, commander setup
│   │   └── commands/
│   │       ├── validate.ts       # doraval validate <path>
│   │       └── score.ts          # doraval score <path>
│   ├── core/                     # Core engine (agent-agnostic)
│   │   ├── package.ts            # Package & Component types
│   │   ├── registry.ts           # component type registry
│   │   ├── validator.ts          # validation engine
│   │   └── scorer.ts             # quality scoring engine
│   ├── adapters/                 # Per-agent adapters
│   │   ├── types.ts              # AgentAdapter interface
│   │   ├── detect.ts             # auto-detect which agent
│   │   ├── claude-code.ts        # Claude Code adapter
│   │   ├── grok.ts               # Grok adapter (stub for v0.2)
│   │   └── agentskills.ts        # Generic Agent Skills spec adapter
│   ├── rules/                    # Validation rules per component type
│   │   ├── skill.ts              # SKILL.md validation rules
│   │   ├── manifest.ts           # plugin.json rules
│   │   ├── hooks.ts              # hooks validation rules
│   │   └── mcp.ts                # MCP server rules
│   └── output/                   # Output formatters
│       ├── table.ts              # terminal table formatter
│       ├── json.ts               # JSON output
│       └── markdown.ts           # Markdown output
├── tests/
│   ├── fixtures/                 # sample skills/plugins for testing
│   │   ├── valid-skill/
│   │   ├── invalid-skill/
│   │   └── sample-plugin/
│   └── *.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Core Model

The central abstraction is a **Package** — a directory containing one or more components. A Package can be a standalone skill (single SKILL.md) or a full plugin with multiple component types.

```typescript
interface Package {
  path: string;                      // root directory
  type: "skill" | "plugin";         // standalone skill vs full plugin
  agent: string;                     // detected agent
  manifest?: Manifest;               // plugin.json (if plugin)
  components: Component[];           // everything inside
}

interface Component {
  kind: string;                      // "skill" | "command" | "agent" | "hook" | "mcp-server" | "rule" | ...
  path: string;                      // file or directory path
  [key: string]: unknown;            // component-specific fields
}
```

Component types are registered in an open registry. Each type provides:
- A **detector**: does this file/directory match this component type?
- A **parser**: extract structured data from the raw files
- A **validator**: check for errors and warnings
- A **scorer** (optional): rate quality

This means new component types (e.g., a future "workflow" or "template" type) can be added by registering a new entry — no changes to core.

### Agent Adapter Interface

```typescript
interface AgentAdapter {
  name: string;                          // e.g. "claude-code"
  displayName: string;                   // e.g. "Claude Code"
  detect(path: string): DetectionResult; // is this a skill/plugin for this agent?
  discover(path: string): Package;       // parse all components into a Package
}

interface DetectionResult {
  detected: boolean;
  type: "skill" | "plugin";
  confidence: number;                    // 0-1
  reason: string;                        // why this agent was detected
}
```

Auto-detection logic:
1. Look for `.claude-plugin/plugin.json` → Claude Code plugin
2. Look for `.grok/` or Grok-specific frontmatter → Grok skill
3. Look for `SKILL.md` with standard frontmatter → Generic Agent Skills spec
4. Fall back to user-specified `--agent` flag

## CLI Commands (v0.1)

### doraval validate <path>

Validate structural correctness of a skill or plugin.

```
$ doraval validate ./skills/adding-mcp-oauth/

  doraval v0.1.0 — Validating skill

  Agent:  Agent Skills Spec (auto-detected)
  Path:   ./skills/adding-mcp-oauth/
  Type:   Skill

  Components:
    SKILL.md
      ✓ YAML frontmatter present and parseable
      ✓ name field present: "adding-mcp-oauth"
      ✓ name format valid (kebab-case, 2-64 chars)
      ✓ description field present
      ✓ Markdown body is non-empty
      ✗ Referenced file not found: references/MIGRATION.md
      ✓ scripts/ directory exists and scripts are valid

  Result: 1 error, 0 warnings

  Exit code: 1
```

```
$ doraval validate ./my-plugin/

  doraval v0.1.0 — Validating plugin

  Agent:  Claude Code (auto-detected)
  Path:   ./my-plugin/
  Type:   Plugin

  Manifest (.claude-plugin/plugin.json):
    ✓ Valid JSON
    ✓ name: "my-plugin" (valid format)
    ✓ version: "1.0.0" (valid semver)
    ⚠ No description field

  Skills (3 found):
    skills/auth/SKILL.md           ✓ valid
    skills/deploy/SKILL.md         ✓ valid
    skills/monitor/SKILL.md        ✓ valid

  Commands (2 found):
    commands/setup.md              ✓ valid
    commands/teardown.md           ⚠ missing description

  Hooks:
    hooks/hooks.json               ✓ valid JSON
    hooks/validate-write.sh        ✓ script exists

  MCP Servers:
    .mcp.json                      ✓ valid JSON
    github server                  ✓ command found

  Result: 0 errors, 2 warnings
```

### doraval score <path>

Quality score with actionable suggestions. v0.1 uses simple pass/warn/fail checks. Multi-dimensional weighted scoring comes in a future version.

```
$ doraval score ./skills/adding-mcp-oauth/

  doraval v0.1.0 — Scoring skill

  Checks:
    ✓ Description includes trigger phrases
    ⚠ Description doesn't mention specific agents (Cursor, Windsurf)
    ✓ Has clear step-by-step instructions
    ✓ Uses imperative voice ("Do X" not "You might X")
    ⚠ No error handling section
    ✓ Has code examples
    ✓ References exist and resolve
    ⚠ No MUST/MUST NOT constraints defined

  Suggestions:
    1. Add agent-specific trigger phrases:
       "Use in Cursor when adding OAuth to an MCP server"
    2. Add an error handling section:
       "What to do if the OAuth redirect fails"
    3. Add constraints (MUST/MUST NOT):
       "MUST use HTTPS for redirect URIs"

  Score: 7/10 checks passed, 3 suggestions
```

### Common Flags

| Short | Long | Description |
|-------|------|-------------|
| `-a` | `--agent <name>` | Force a specific agent adapter (skip auto-detection) |
| `-f` | `--format <json\|table>` | Output format (default: table) |
| `-v` | `--verbose` | Show detailed diagnostics |
| | `--ci` | Machine-friendly output, non-zero exit on any issue |
| `-h` | `--help` | Show help |
| `-V` | `--version` | Show version |

### Expected `--help` Output

```
USAGE
  doraval <command> [options]

COMMANDS
  validate <path>   Validate structure and schema of a skill or plugin
  score <path>      Score quality and get actionable suggestions

OPTIONS
  -a, --agent <name>              Force a specific agent adapter
  -f, --format <json|table>       Output format (default: table)
  -v, --verbose                   Show detailed diagnostics
      --ci                        Machine-friendly output, non-zero exit on issues
  -h, --help                      Show help
  -V, --version                   Show version

EXAMPLES
  # Validate a skill
  doraval validate ./skills/adding-mcp-oauth/

  # Validate a Claude Code plugin
  doraval validate ./my-plugin/

  # Score quality with JSON output
  doraval score ./skills/my-skill/ --format json

  # Use in CI/CD
  doraval validate ./skills/ --ci
```

### Shell Completions

Commander provides built-in shell completion generation. v0.1 ships with completion support for bash, zsh, and fish:

```bash
# Generate completions
doraval completions bash > /usr/local/share/bash-completion/completions/doraval
doraval completions zsh > ~/.zfunc/_doraval
doraval completions fish > ~/.config/fish/completions/doraval.fish
```

### stdout vs stderr Behavior

When output is piped, structured results go to **stdout** and diagnostics/banners go to **stderr**:

```bash
# JSON results on stdout, banner/spinner on stderr
doraval validate ./skill --format json | jq .

# Only errors/warnings on stdout when piped
doraval validate ./skill 2>/dev/null
```

Rules:
- Validation results, scores, JSON output → **stdout**
- Version banner, spinners, progress indicators, debug logs → **stderr**
- TTY detection: when stdout is not a TTY, suppress colors and spinners automatically

### Input Validation & Error Messages

Errors follow the Context → Problem → Solution pattern:

**Nonexistent path:**
```
✗ Path not found: ./does-not-exist/

Check that the path is correct and the directory exists.
```

**No skill or plugin detected:**
```
✗ No skill or plugin found at ./empty-dir/

Searched for:
  • SKILL.md (Agent Skills spec)
  • .claude-plugin/plugin.json (Claude Code plugin)
  • .grok/ directory (Grok skill)

Try:
  • Check the path points to a skill or plugin directory
  • Use --agent to force a specific adapter
  • Run 'doraval init' to create a new skill
```

**Unparseable YAML frontmatter:**
```
✗ Failed to parse YAML frontmatter in SKILL.md

  Line 3: unexpected end of stream
    description: "missing closing quote

Fix the YAML syntax and retry.
```

## Validation Rules (v0.1)

### Skills (SKILL.md)

| Rule | Severity | Check |
|------|----------|-------|
| Has YAML frontmatter | error | `---` delimiters present and parseable |
| `name` field present | error | Required by all agent specs |
| `description` field present | error | Required for auto-invocation |
| Name format valid | error | kebab-case, 2-64 chars, alphanumeric + hyphens |
| Body is non-empty | error | Markdown body after frontmatter exists |
| Referenced files exist | warning | Scripts, references, assets all resolve |
| No broken internal links | warning | `references/foo.md` actually exists |

### Plugin Manifest (plugin.json)

| Rule | Severity | Check |
|------|----------|-------|
| Valid JSON | error | Parseable |
| `name` field present | error | Required |
| Name format valid | error | kebab-case |
| `version` is semver | warning | MAJOR.MINOR.PATCH |
| Paths use `./` prefix | error | No absolute paths |
| Referenced dirs exist | warning | commands/, agents/, skills/ dirs resolve |

### Hooks

| Rule | Severity | Check |
|------|----------|-------|
| Valid JSON config | error | hooks.json parseable |
| Scripts exist | error | Referenced .sh/.js files resolve |
| Valid event names | warning | Known events (PreToolUse, PostToolUse, Stop, etc.) |

### MCP Servers

| Rule | Severity | Check |
|------|----------|-------|
| Valid JSON config | error | .mcp.json parseable |
| Command exists | warning | Binary/script is on PATH or relative |
| Env vars documented | info | Flag undocumented env var references |

## Quality Scoring (v0.1)

Simple pass/warn/fail checks for v0.1. Multi-dimensional weighted scoring (description quality, instruction clarity, structure, completeness, agent compatibility) planned for future.

v0.1 checks:
- Description includes trigger phrases
- Description mentions target agents
- Has clear steps/checklist
- Uses imperative voice
- Has constraints (MUST/MUST NOT)
- Has error handling guidance
- Has code examples (when relevant)
- All referenced files exist
- Appropriate content length
- No ambiguous language ("maybe", "consider", "possibly")

Each check passes, warns, or fails. Suggestions are generated for anything that doesn't pass.

## Tech Stack

**Runtime:** Bun

**Bun builtins (zero deps):**
- File I/O: `Bun.file()`, `Bun.write()`
- Testing: `bun:test`
- JSON parsing: native
- Glob: `Bun.Glob`
- Binary compilation: `bun build --compile`

**External dependencies:**

| Package | Purpose |
|---------|---------|
| `commander` | CLI parsing, --help, subcommands |
| `gray-matter` | YAML frontmatter parsing from SKILL.md |
| `zod` | Schema validation for manifests/configs |
| `chalk` | Colored output with TTY/NO_COLOR detection |
| `ora` | Spinners for longer operations |

**CLI patterns:**
- Exit codes: 0 (success), 1 (validation errors), 2 (CLI misuse)
- Error format: Context → Problem → Solution
- Help text: USAGE → COMMANDS → OPTIONS → EXAMPLES
- `--ci` flag: machine-friendly output, non-zero exits
- Startup target: < 50ms
- Respects `NO_COLOR` env var
- Handles SIGINT (Ctrl+C) gracefully

**Distribution:**
- `npx doraval` / `bunx doraval`
- `npm install -g doraval`
- `bun build --compile` for single binary

### Configuration Layer

Priority order (highest to lowest):
1. **CLI flags** — `--agent claude-code`, `--format json`
2. **Environment variables** — `DORAVAL_AGENT`, `DORAVAL_FORMAT`, `DORAVAL_CI`
3. **Defaults** — auto-detect agent, table format, no CI mode

No config file for v0.1. Env vars provide non-interactive defaults for CI/CD without adding file discovery complexity. Config file support (`.doravalrc` or `doraval.config.yaml`) is a v0.2 candidate if users need project-level defaults.

Env var naming convention: `DORAVAL_` prefix + UPPER_SNAKE flag name.

### Cross-Platform

doraval targets macOS, Linux, and Windows via Bun's cross-platform runtime.

Platform-specific considerations:
- Use `path.join()` / `path.resolve()` for all path construction (no hardcoded `/`)
- Use `os.homedir()` for user home directory (no hardcoded `~`)
- Use `Bun.file()` for file existence checks (works cross-platform)
- CI matrix tests on ubuntu-latest, macos-latest, windows-latest
- Shell completion generation adapts to detected shell

## Phasing

### v0.1 (MVP)
- `doraval validate <path>` — structural validation
- `doraval score <path>` — quality checks + suggestions
- Claude Code adapter (plugins + skills)
- Agent Skills spec adapter (generic SKILL.md)
- Core adapter interface and component registry
- JSON + table output formats

### v0.2
- Grok adapter
- Cursor/Windsurf adapter (path detection)
- `doraval init` — scaffold rubric and skill templates
- `doraval agents` — list supported agents
- Markdown output format

### v0.3
- `doraval eval <path> --rubric <file>` — rubric-based session execution
- `doraval drift --session <transcript>` — session transcript analysis
- `doraval report <path> --issue` — GitHub issue creation
- Headless agent execution (claude --headless, grok --headless)
- API-based execution as alternative
- Multi-dimensional weighted scoring

## Rubric Format (v0.3 Preview)

```yaml
name: "OAuth skill test"
skill: ./skills/adding-mcp-oauth/SKILL.md
agent: claude-code  # or auto
tests:
  - name: "triggers on OAuth request"
    prompt: "Add OAuth to my MCP server"
    expect:
      triggered: true
      drift_threshold: 0.2
      must_mention: ["SCALEKIT_ENV_URL", "client credentials"]
      must_not_mention: ["passport.js", "auth0"]
  - name: "follows step order"
    prompt: "Secure my Express MCP server with OAuth"
    expect:
      steps_followed: ["install SDK", "configure env", "add middleware"]
```

## Drift Detection Model (v0.3 Preview)

Three dimensions of drift:

1. **Trigger accuracy** — Did the skill trigger when the prompt matched its description? Did it NOT trigger when the prompt was unrelated?
2. **Instruction adherence** — Did the agent follow the steps in order? Did it skip checklist items? Did it hallucinate its own approach?
3. **Scope containment** — Did the agent stay within the skill's scope? Did it add unnecessary features, refactor unrelated code, or go off-script?

Each dimension produces a 0-1 score. The composite drift score is a weighted average. A drift score of 0 means perfect adherence; 1 means complete drift.

Session execution runs the agent for a configurable duration (~30s default), captures the model trace (thinking/reasoning), and evaluates against rubrics.

## Open Questions

1. **Transcript format** — Claude Code and Grok store session transcripts differently. Need to reverse-engineer both formats for v0.3.
2. **Scoring weights** — The multi-dimensional scoring weights need calibration against real skill data. Start simple, add weights based on what correlates with actual quality.
3. **Agent execution** — Each agent's headless mode has different capabilities. Some may not expose model traces. Need to document what's available per agent.