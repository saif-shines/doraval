# doraval

The context engineering toolkit for coding agent orchestrators.

If you're a senior engineer handing skills to new team members, a company publishing AI resources, or anyone who wants agents (and humans) to succeed on the first attempt instead of after days of debugging — this is for you.

**The orchestrator problem:** Give 10 new engineers (or agents) a skill and only 3/10 succeed on the first try. 4/10 take hours. 7/10 take a day. 10/10 take days.

doraval helps you **left-shift success** — validate, scaffold, and manage context so the first attempt works across Claude, Cursor, Codex, Copilot, and whatever comes next.

> **Quick start (left-shift success in < 2 minutes):**
> ```bash
> # macOS
> brew install saif-shines/tap/doraval
> doraval validate .
>
> # Everyone else
> npx @hacksmith/doraval validate .
> ```

Validate before you hand a skill to a new engineer or publish it. It auto-detects issues across agents and tells you what's broken.

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
# if Bun is not installed: npm i -g bun
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
| `claude:skill` | `SKILL.md` | Frontmatter (all known fields), body, supporting files, dynamic injection (!`...`, $ARGUMENTS, ${CLAUDE_*}), advanced fields, unknown field warnings |
| `claude:plugin` | `.claude-plugin/plugin.json` | Full manifest schema (name, version rules, displayName, author, license, keywords, defaultEnabled, userConfig, channels, dependencies, ...), path rules (./, replace vs augment), .claude-plugin/ purity (only manifest allowed inside), default dirs + co-existence warnings, root SKILL.md single-skill layout, unrecognized fields + suggestions, version pinning semantics |
| `claude:marketplace` | `plugins/` | Plugin directory structure, README, LICENSE |
| `claude:hooks` | `hooks/hooks.json` or `hooks.json` | All 30+ lifecycle events (full list), hook group structure (matcher + hooks[]), supported types (command/http/mcp_tool/prompt/agent), basic required fields per type, substitution notes |
| `claude:mcp` | `.mcp.json` | Server entries (command+args stdio or url), env/cwd, substitution detection (${CLAUDE_PLUGIN_*} etc) |
| `claude:lsp` | `.lsp.json` (or inline) | Per-language: required command + extensionToLanguage map; notes on separate binary install requirement |
| `claude:monitors` | `monitors/monitors.json` (or experimental) | Array entries (name, command, description, when), unique names, substitution support; experimental caveats |
| `claude:subagent` | `agents/*.md` | Supported frontmatter (name/desc/model/effort/maxTurns/tools/disallowedTools/skills/memory/background/isolation=worktree), disallowed security fields (hooks/mcpServers/permissionMode) are errors, non-empty body |
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

### `eval` — Did the agent follow the skill?

After a real session, evaluate whether the coding agent actually adhered to the skills it invoked.

```bash
doraval eval                    # pick from recent sessions interactively
doraval eval --verbose
doraval judge ./skills/improve/ # evaluate latest session for one skill
doraval eval history
```

`eval` uses an LLM judge (via your configured agent) to produce a per-skill `PASS`/`FAIL` with a dynamic checklist, user familiarity score, and closure information (1-shot vs multi-turn vs incomplete).

Requires `doraval init` first. See the [full docs](https://doraval.thehacksmith.dev/commands/eval/).

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

### `ui` — Local dashboard (avoid typing repetitive commands)

```bash
doraval ui                 # start the web dashboard (opens browser)
doraval ui --port 4921     # different port
doraval ui --status        # check if running + show URL
doraval ui --force         # force restart
```

Re-running `doraval ui` is now idempotent (uses PID tracking). Use `--force` to restart.

doraval update              # self-update doraval to the latest version
doraval claude new          # interactive wizard for skills/plugins (follows official table)

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
doraval eval --ci --format json
```

Exits with code `1` when errors are found. Pipe `--format json` output to `jq` or consume programmatically.

## Providers

Claude Code, Cursor, Codex, and Copilot CLI validators and scaffolding built in. OpenCode support is experimental.

## Links

- [Docs](https://doraval.thehacksmith.dev)
- [JSR package](https://jsr.io/@hacksmith/doraval)
- [npm package](https://www.npmjs.com/package/@hacksmith/doraval)
- [GitHub Releases](https://github.com/saif-shines/doraval/releases)
