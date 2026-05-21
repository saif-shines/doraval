# doraval

Validate, score, and test skills and plugins for AI coding agents.

Supports any agent following the [Agent Skills spec](https://agentskills.io/specification): Claude Code, Cursor, Windsurf, Grok, and others.

## Install

```bash
npm install -g doraval
```

Or run without installing:

```bash
npx doraval validate ./my-skill
```

## Usage

### Validate a skill

```bash
doraval validate ./skills/adding-mcp-oauth/
```

### Score quality

```bash
doraval score ./skills/adding-mcp-oauth/
```

### JSON output (for CI/CD)

```bash
doraval validate ./skills/my-skill/ --format json
```

## License

MIT
