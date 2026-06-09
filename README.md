# doraval

The context engineering toolkit for coding agents.

If you've ever shipped a Claude Code skill that stopped firing after a refactor, or wondered whether your plugin's structure actually matches what the agent expects — doraval validates that before it becomes a runtime surprise.

> **Quick start:**
> ```bash
> # macOS
> brew install saif-shines/tap/doraval
> doraval validate .
>
> # Everyone else
> npx @hacksmith/doraval validate .
> ```

Point it at any local directory or GitHub URL. It auto-detects what you have and tells you what's broken.

## Install

### macOS (Homebrew — recommended)

```bash
brew tap saif-shines/tap
brew install doraval
```

No runtime required. The binary is self-contained.

### npm / npx

```bash
npx @hacksmith/doraval validate .        # run without installing
npm install -g @hacksmith/doraval        # or install globally
```

Requires Node.js. If Bun is installed, it runs faster — but Node works fine.

### Bun

```bash
bunx @hacksmith/doraval validate .       # run without installing
bun add -g @hacksmith/doraval            # or install globally
```

## Usage

### `validate` — Auto-detect and validate

Point it at a directory or GitHub URL. It finds what's there and checks it.

```bash
doraval validate .                                          # local directory
doraval validate https://github.com/obra/superpowers        # remote repo
doraval validate https://github.com/obra/superpowers/tree/main/skills/brainstorming
```

Filter by provider or validator:

```bash
doraval validate . --for claude           # all Claude validators
doraval validate . --for claude:plugin    # just the plugin validator
```

#### Validators (Claude)

| Validator | Detects | Checks |
|---|---|---|
| `claude:skill` | `SKILL.md` | Frontmatter, body, supporting files, dynamic injection, advanced fields |
| `claude:plugin` | `.claude-plugin/plugin.json` | Manifest fields, component paths |
| `claude:marketplace` | `plugins/` | Plugin directory structure, README, LICENSE |
| `claude:hooks` | `hooks/hooks.json` | Valid JSON, known event names |
| `claude:mcp` | `.mcp.json` | Valid JSON, server definitions |
| `claude:subagent` | `agents/*.md` | Frontmatter with description, non-empty body |
| `claude:command` | `commands/*.md` | Frontmatter, body, advanced fields |
| `claude:memory` | `CLAUDE.md` | Non-empty, length limit, @path import resolution |

### `skill validate` — Single skill structural check

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
  ✓ advanced frontmatter: allowed-tools, context
  ✓ uses dynamic context injection

  Result: 0 error(s), 0 warning(s)
```

### `skill drift` — Rubric deviation

Measure how far a skill has drifted from known-good rubric standards.

```bash
doraval skill drift ./skills/my-skill/
```

```
  doraval skill drift — Measuring rubric drift

  · Trigger    Description includes activation phrases
  · Structure  Has step-by-step instructions
  · Voice      Uses imperative voice
  ↗ Example    No code blocks found
  ↗ Guardrail  No explicit constraints
  · Clarity    No ambiguous language found

  2/6 rubric areas have drifted.
```

| Category | Checks |
|---|---|
| **Trigger** | Description includes activation phrases (`Use when...`) |
| **Structure** | Body has numbered steps or checklists |
| **Voice** | Uses imperative language (`Create`, `Run`, `Ensure`) |
| **Example** | Contains code blocks |
| **Guardrail** | Has explicit `MUST` / `MUST NOT` constraints |
| **Clarity** | Free of ambiguous words (`maybe`, `perhaps`, `consider`) |

### `journal` — Decision memory

Record and sync project principles so future you (and agents) don't accidentally contradict past choices.

```bash
doraval init                  # set up journal + configure agent
doraval journal list          # view active principles
doraval journal add "..."     # propose a decision
doraval journal sync          # publish pending entries
doraval journal update        # pull latest from remote
```

Requires the GitHub CLI (`gh`). Journal lives in a private GitHub repo you control.

## Options

| Flag | Short | Description |
|---|---|---|
| `--format <type>` | `-f` | `table` (default) or `json` |
| `--for <spec>` | | Target a provider or specific validator |
| `--verbose` | `-v` | Show detailed diagnostics |
| `--ci` | | Machine-friendly output, non-zero exit on issues |

### CI/CD

```bash
doraval validate . --for claude --format json --ci
doraval skill validate ./my-skill/ --format json --ci
doraval skill drift ./my-skill/ --format json --ci
```

Exits with code `1` when errors are found. Pipe `--format json` output to `jq` or consume programmatically.

## Providers

Claude Code validators built in. Cursor, Codex, and Windsurf coming next.

## Links

- [Docs](https://thehacksmith.dev)
- [JSR package](https://jsr.io/@hacksmith/doraval)
- [npm package](https://www.npmjs.com/package/@hacksmith/doraval)
- [GitHub Releases](https://github.com/saif-shines/doraval/releases)
