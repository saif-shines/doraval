# doraval

**Make agent context work on every try.** Context engineering toolkit for coding agents — scan, review, fix, and remember skills, plugins, and decisions across Claude, Cursor, Codex, Copilot, and Grok.

**doraval** (*dor-uh-val*) = **Doraemon** + **eval**. `dora` and `doraval` are the same CLI.

[Docs](https://doraval.thehacksmith.dev) · [Audit](https://doraval.thehacksmith.dev/get-started/audit/) · [Quickstart](https://doraval.thehacksmith.dev/get-started/quickstart/) · [Command reference](https://doraval.thehacksmith.dev/commands/) · [npm](https://www.npmjs.com/package/@hacksmith/doraval)

Context you cannot rely on wastes a million tokens: broken skills, silent Claude-vs-Cursor contradictions, decisions that vanish next session.

## First steps

### 1. Install the doraval skill

```bash
npx skills add saif-shines/doraval
```

Agents load this checklist when you edit skills, plugins, rules, or agent config. The skill runs the same engine as the CLI (`dora` or `npx @hacksmith/doraval`).

### 2. Review context on this project

```bash
npx @hacksmith/doraval
# after permanent install: dora
```

Read-only. No API key. Surfaces, skill health, contradictions, and next actions.

```text
$ dora

  Health
    ✓ .claude/skills/review    valid
    ✗ .claude/skills/deploy    Missing "description"

  Next
    1. dora fix .claude/skills/deploy
    2. dora review --all
```

**Short path:** [Audit my agent context](https://doraval.thehacksmith.dev/get-started/audit/) (skill + `dora review`).  
**Full tour:** [Quickstart](https://doraval.thehacksmith.dev/get-started/quickstart/) (install, scan, review, fix, scaffold, memory).

## Install the CLI (optional)

```bash
# one-shot
npx @hacksmith/doraval

# npm
npm install -g @hacksmith/doraval

# Homebrew (macOS)
brew tap saif-shines/tap && brew trust saif-shines/tap && brew install doraval

# Bun
bun add -g @hacksmith/doraval
```

Prebuilt binaries: macOS arm64/x64, Linux x64/arm64, Windows x64 (Node ≥ 14.18). Alpine/musl: use Bun. Details: [Installation](https://doraval.thehacksmith.dev/get-started/installation/).

## Commands

| Command | Job |
| --- | --- |
| `dora` / `scan` | Repo diagnosis: surfaces, health, contradictions, next actions |
| `review` | Quality gate: structure → heuristics → LLM → sessions |
| `fix` | Mechanical fixes (`--yes` / `--dry-run` / `--brief`) |
| `new --for` | Scaffold skill, rule, agent, or plugin |
| `memory` | Principles; enforce in review; promote to AGENTS.md |
| `reconcile` | Cross-agent contradictions → shared AGENTS.md |
| `sessions` | List / show recent agent sessions |
| `config` | Judge / model / settings |
| `bump` | Semver in plugin / marketplace manifests |
| `providers` | Packaging/spec matrix (not local “which agents”) |
| `update` | Self-update |

Full flags: [Command reference](https://doraval.thehacksmith.dev/commands/).

```bash
dora review . --quick --ci
dora review --deep ./skills/foo
dora fix . --dry-run
dora memory add "Never use default exports" --weight 8
dora reconcile --dry-run
```

Exit codes: `0` clean · `1` issues · `2` could not run. Agents/CI: `--format json` / `--ci`.

## Use with your agent

After `npx skills add saif-shines/doraval`, the agent can run checks when context changes. Same CLI:

```text
Review my agent context with dora (npx @hacksmith/doraval). Fix with --yes. Do not report done until review exits 0.
```

JSON, exit codes, CI: [Use with your agent](https://doraval.thehacksmith.dev/for-agents/).

## CI

```bash
npx @hacksmith/doraval review --all --quick --ci
dora --format json | jq '.summary'
```

## Links

- [Documentation](https://doraval.thehacksmith.dev)
- [npm](https://www.npmjs.com/package/@hacksmith/doraval) · [JSR](https://jsr.io/@hacksmith/doraval) · [Releases](https://github.com/saif-shines/doraval/releases)
