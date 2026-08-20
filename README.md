# doraval

Context-engineering CLI for coding agents. It reviews skills, rules, and memory so Claude, Cursor, Codex, Copilot, and Grok work from context you can trust.

`dora` and `doraval` are the same binary. Pronunciation: *dor-uh-val* (Doraemon + eval).

## Installation

```sh
npm install -g @hacksmith/doraval
```

```sh
# macOS
brew tap saif-shines/tap && brew trust saif-shines/tap && brew install doraval

# Bun
bun add -g @hacksmith/doraval
```

Node ≥ 14.18. Alpine/musl: use Bun. See the [installation guide](https://doraval.dev/get-started/installation/).

## Quick start

```sh
npx skills add saif-shines/doraval
dora review --quick
```

`--quick` is structure and heuristics only. No Judge. No API key.

You get a Review with Findings. Exit `0` clean · `1` issues · `2` could not run.

## Docs

[doraval.dev](https://doraval.dev) has get started, command reference, and review tiers.

## Building from source

Requirements:

- **[Bun](https://bun.sh)** ≥ 1.3
- Node ≥ 14.18 for the published binary target

```sh
bun install
bun run dev -- --help          # run CLI from source
bun run build                  # emit bin/doraval.js
```

## Repository layout

| Path | Contents |
|------|----------|
| `src/cli/` | citty CLI surface (`dora` / `doraval`) |
| `src/core/` | Scan, review, fix, memory, sessions, scaffold |
| `src/providers/` | Packaging / provider specs (`dora new`, `dora providers`) |
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

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md) for conventions (ponytail ladder, no version bumps unless releasing).

## Contributing

Issues and PRs are welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

MIT. See [`package.json`](package.json) (`"license": "MIT"`).
