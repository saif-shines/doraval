# doraval

**Make agent context work on every try.** Context engineering toolkit for coding agents. Scan, review, fix, and remember skills, plugins, and decisions for yourself, your team, or your community.

**doraval** (*dor-uh-val*) = **Doraemon** + **eval**. The `dora` CLI runs on your project; your agent can run the same checks when you want automation.

[Docs](https://doraval.thehacksmith.dev) · [Use with your agent](https://doraval.thehacksmith.dev/for-agents/) · [npm](https://www.npmjs.com/package/@hacksmith/doraval)

**The problem:** context you cannot rely on wastes a million tokens — broken skills, silent contradictions between Claude and Cursor, decisions that vanish next session.

**The win:** scan → review → fix → remember, so every attempt succeeds across Claude, Cursor, Codex, Copilot, and Grok.

## First win (< 2 minutes)

### 1. Install the doraval skill (first step)

```bash
npx skills add saif-shines/doraval
```

### 2. Review my context

```bash
npx @hacksmith/doraval
# or, after install: dora
```

Zero config. No API key. Bare `dora` scans the repo: which agents are configured, every skill's health, cross-agent contradictions, and the exact next command to run.

```text
$ dora

  doraval v0.6.x
  Read-only scan of agent context. No writes, no LLM.

  Agent surfaces
    ✓ claude    CLAUDE.md  .claude/skills
    ⚠ cursor    not configured

  Health
    ✓ .claude/skills/review    valid
    ✗ .claude/skills/deploy    Missing "description"

  Next
    1. dora fix .claude/skills/deploy
    2. dora review --all
```

## Commands

| Command | Job |
|---|---|
| `dora` / `scan` | Repo diagnosis: surfaces, health, contradictions, next actions |
| `review` | Quality gate: structure → heuristics → LLM → sessions (tiers skip if unavailable) |
| `fix` | Apply mechanical fixes (`--yes` / `--dry-run` / `--brief` for agents) |
| `new --for` | Scaffold skill, rule, agent, or plugin |
| `memory` | Principles that stick; enforce in review; promote to AGENTS.md; optional git backup |
| `reconcile` | Settle cross-agent contradictions (interactive or `--apply`) |
| `sessions` | List / show recent agent sessions (Claude, Grok, Cursor, Codex, Copilot) |
| `config` | Dot-notation settings (`eval.model`, …) |
| `bump` | Semver in plugin / marketplace manifests |
| `providers` | Packaging/spec reference (repo support → bare `dora`) |
| `update` | Self-update |

Shell tab-completion (install plumbing, not a product command): `dora --completion zsh` (or `bash` / `fish`).

```bash
dora review . --quick --ci          # structural gate, no LLM
dora review --deep ./skills/foo     # require LLM tier (exit 2 if no judge)
dora fix . --dry-run
dora memory list
dora memory promote                 # hard rules → AGENTS.md (diff + confirm)
dora memory sync                    # optional private git backup
dora sessions
dora sessions show <id>
dora reconcile --dry-run
```

Exit codes: `0` clean · `1` issues found · `2` could not run. Use `--format json` for agents and CI.

> **`dora journal` was removed.** Memory is the only path. First `dora memory` after upgrade migrates legacy entries once. Hooks: `dora memory context --json`. Details: [Memory](https://doraval.thehacksmith.dev/concepts/memory/).

Old `validate` / `lint` / `judge` / `eval` / `drift` folded into `dora review` (structure, heuristics, LLM, sessions).

## Install

### CLI

```bash
# No install
npx @hacksmith/doraval

# npm
npm install -g @hacksmith/doraval

# Homebrew (macOS)
brew tap saif-shines/tap && brew trust saif-shines/tap && brew install doraval

# Bun
bunx @hacksmith/doraval
bun add -g @hacksmith/doraval
```

npm ships a prebuilt binary per platform (macOS arm64/x64, Linux x64/arm64, Windows x64). Node ≥ 14.18. Alpine/musl: run from source with Bun.

### Doraval skill (first step)

```bash
npx skills add saif-shines/doraval
```

Installs the doraval skill so agents run `dora` / `npx @hacksmith/doraval` when you edit context. Details: [Use with your agent](https://doraval.thehacksmith.dev/for-agents/).

## CI

```bash
npx @hacksmith/doraval review --all --quick --ci
dora --format json | jq '.summary'
```

## Links

- [Documentation](https://doraval.thehacksmith.dev): get started, commands, [memory](https://doraval.thehacksmith.dev/concepts/memory/)
- [Use with your agent](https://doraval.thehacksmith.dev/for-agents/): `npx skills add`, JSON, exit codes
- [npm](https://www.npmjs.com/package/@hacksmith/doraval) · [JSR](https://jsr.io/@hacksmith/doraval) · [Releases](https://github.com/saif-shines/doraval/releases)
