<div align="center">

<h1>
  <img alt="doraval" src="https://raw.githubusercontent.com/saif-shines/doraval/main/apps/website/public/icon.svg" width="72">
  <br>
  doraval (<code>dora</code>)
</h1>

**doraval** is a context engineering toolkit for coding agents. It scans,
reviews, fixes, and remembers agent context — skills, plugins, rules, and
decisions — so Claude, Cursor, Codex, Copilot, and Grok work on every try
instead of burning tokens on context you cannot rely on.

[Installing](#installing) ·
[Building from source](#building-from-source) ·
[Documentation](#documentation) ·
[Repository layout](#repository-layout) ·
[Development](#development) ·
[Contributing](#contributing) ·
[License](#license)

**Learn more about doraval at [doraval.thehacksmith.dev](https://doraval.thehacksmith.dev)**

This repository contains the TypeScript source for the `dora` / `doraval` CLI,
its validators, and the agent skill shipped via
`npx skills add saif-shines/doraval`.

**Pronunciation:** *dor-uh-val* · Doraemon + eval

</div>

---

## Installing

### Skill (recommended first step)

Installs the agent skill so coding agents load the Doraval checklist when you
edit skills, plugins, rules, or agent config:

```sh
npx skills add saif-shines/doraval
```

### CLI

Prebuilt binaries for macOS, Linux, and Windows:

```sh
# one-shot (no install)
npx @hacksmith/doraval

# permanent
npm install -g @hacksmith/doraval

# macOS
brew tap saif-shines/tap && brew trust saif-shines/tap && brew install doraval

# Bun
bun add -g @hacksmith/doraval

dora --version    # same binary as doraval
```

Node ≥ 14.18. Alpine/musl: use Bun. See the [changelog](CHANGELOG.md) and
[installation guide](https://doraval.thehacksmith.dev/get-started/installation/).

### First run

```sh
npx @hacksmith/doraval              # scan this project
npx @hacksmith/doraval review .     # quality gate
```

```text
$ dora

  Health
    ✓ .claude/skills/review    valid
    ✗ .claude/skills/deploy    Missing "description"

  Next
    1. dora fix .claude/skills/deploy
    2. dora review --all
```

Read-only scan. No API key. Exit codes: `0` clean · `1` issues · `2` could not run.

**Paths:**
[Audit my agent context](https://doraval.thehacksmith.dev/get-started/audit/) ·
[Quickstart](https://doraval.thehacksmith.dev/get-started/quickstart/) ·
[Use with your agent](https://doraval.thehacksmith.dev/for-agents/)

```sh
npx @hacksmith/doraval review --all --quick --ci
```

## Building from source

Requirements:

- **[Bun](https://bun.sh)** ≥ 1.3
- Node ≥ 14.18 for the published binary target

```sh
bun install
bun run dev -- --help          # run CLI from source
bun run build                  # emit bin/doraval.js
```

## Documentation

Full documentation: [doraval.thehacksmith.dev](https://doraval.thehacksmith.dev)

| Path | Contents |
|------|----------|
| [Getting started](https://doraval.thehacksmith.dev/get-started/) | Audit vs Quickstart |
| [Command reference](https://doraval.thehacksmith.dev/commands/) | All flags on one page |
| [Use with your agent](https://doraval.thehacksmith.dev/for-agents/) | Skill, JSON, exit codes, CI |
| [Memory](https://doraval.thehacksmith.dev/concepts/memory/) | Principles that stick |
| [Review tiers](https://doraval.thehacksmith.dev/concepts/review-tiers/) | Structure → heuristics → LLM → sessions |

### Commands

| Command | Job |
|---------|-----|
| `dora` / `scan` | Surfaces, health, contradictions, next actions |
| `review` | Quality gate (structure → heuristics → LLM → sessions) |
| `fix` | Mechanical fixes (`--yes` / `--dry-run` / `--brief`) |
| `new --for` | Scaffold skill, rule, agent, or plugin |
| `memory` | Principles; enforce in review; promote to AGENTS.md |
| `reconcile` | Cross-agent contradictions → shared AGENTS.md |
| `sessions` | List / show recent agent sessions |
| `config` | Judge / model / settings |
| `bump` | Semver in plugin / marketplace manifests |
| `providers` | Packaging/spec matrix |
| `update` | Self-update |

```sh
dora review . --quick --ci
dora fix . --dry-run
dora memory add "Never use default exports" --weight 8
dora reconcile --dry-run
```

Shell completions: `dora --completion zsh` (or `bash` / `fish`).

## Repository layout

| Path | Contents |
|------|----------|
| `src/cli/` | citty CLI surface (`dora` / `doraval`) |
| `src/core/` | Scan, review, fix, memory, sessions, scaffold |
| `src/validators/` | Per-agent validators (Claude, Cursor, Codex, Copilot, Grok) |
| `src/providers/` | Packaging / provider specs |
| `skills/doraval/` | Agent skill shipped via `npx skills add saif-shines/doraval` |
| `apps/website/` | Docs site ([Blume](https://github.com/saif-shines/blume)) |
| `scripts/` | Release, platform packages, publish helpers |
| `test/` | Fixtures and CLI tests |
| `bin/` | Built CLI entry (`doraval.cjs`) |

## Development

```sh
bun install
bun run dev -- --help          # run from source
bun test                       # unit + CLI tests
bun run typecheck
bun run build                  # emit bin/doraval.js
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md) for
conventions (ponytail ladder, no version bumps unless releasing).

## Contributing

Issues and PRs are welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

MIT — see [`package.json`](package.json) (`"license": "MIT"`).
