# doraval

Validate, measure drift, and judge skills and plugins for AI coding agents.

Supports any agent following the [Agent Skills spec](https://agentskills.io/specification): Claude Code, Cursor, Windsurf, Grok, and others.

## Install

Requires [Bun](https://bun.sh) v1.2+.

```bash
bun install -g doraval
```

Or run without installing:

```bash
bunx doraval skill validate ./my-skill
```

## Usage

```
doraval skill <command> <path> [options]
```

### Validate structure

Check that a skill has valid frontmatter, required fields, and expected file layout.

```bash
doraval skill validate ./skills/adding-mcp-oauth/
```

### Measure drift

Measure how far a skill has drifted from rubric standards — trigger phrases, imperative voice, code examples, guardrails, and clarity.

```bash
doraval skill drift ./skills/adding-mcp-oauth/
```

### Judge (AI-driven)

Send a skill to an LLM for qualitative assessment of clarity, completeness, and effectiveness. *(Coming soon.)*

```bash
doraval skill judge ./skills/adding-mcp-oauth/
```

### Options

| Flag | Short | Description |
|---|---|---|
| `--format` | `-f` | Output format: `table` (default) or `json` |
| `--agent` | `-a` | Force a specific agent adapter |
| `--verbose` | `-v` | Show detailed diagnostics |
| `--ci` | | Machine-friendly output, non-zero exit on issues |

### JSON output (for CI/CD)

```bash
doraval skill validate ./my-skill/ --format json --ci
doraval skill drift ./my-skill/ --format json --ci
```

## License

MIT
