# doraval

**Scale your AI context for coding agents.** Make skills, plugins, and decisions work on the first try — for yourself, your team, or your community.

**doraval** (*dor-uh-val*) = **Doraemon** + **eval**. The `dora` alias is the same CLI.

[Docs](https://doraval.thehacksmith.dev) · [Quickstart](https://doraval.thehacksmith.dev/get-started/quickstart/) · [npm](https://www.npmjs.com/package/@hacksmith/doraval)

**The problem:** context you cannot trust until someone has already wasted a day debugging it — broken skills, silent contradictions between Claude and Cursor, decisions that vanish next session.

**The win:** scan → review → fix → remember, so the first attempt succeeds across Claude, Cursor, Codex, Copilot, and Grok.

## First win (< 2 minutes)

```bash
npx @hacksmith/doraval
# or, after install: dora
```

Zero config. No API key. Bare `dora` scans the repo: which agents are configured, every skill's health, cross-agent contradictions, and the exact next command to run.

```
$ dora

  doraval v0.6.1
  Read-only scan of agent context — no writes, no LLM.

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

## The loop

```bash
dora                                          # scan
dora new skill --for claude --name review-pr --description "Reviews PRs" --yes
dora review .                                 # structure + heuristics (+ LLM when available)
dora fix .                                    # diffs first; asks before writing
dora memory add "Run tests before shipping skill changes" --weight 8
```

Prefer `dora new --for <agent>`. Thin wrappers (`dora claude new`, …) still work.

## Commands

| Command | Job |
|---|---|
| `dora` / `scan` | Repo diagnosis: surfaces, health, contradictions, next actions |
| `review` | Quality gate — structure → heuristics → LLM → sessions (tiers skip if unavailable) |
| `fix` | Apply mechanical fixes (`--yes` / `--dry-run` / `--brief` for agents) |
| `new --for` | Scaffold skill, rule, agent, or plugin |
| `memory` | Principles that stick; enforce in review; promote to AGENTS.md; optional git backup |
| `reconcile` | Settle cross-agent contradictions (interactive or `--apply`) |
| `sessions` | List / show recent agent sessions (Claude Code, Grok today) |
| `config` | Dot-notation settings (`eval.model`, …) |
| `bump` | Semver in plugin / marketplace manifests |
| `providers` | Packaging matrix per agent |
| `update` / `completion` | Self-update · shell completions |

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

## CI

```bash
npx @hacksmith/doraval review --all --quick --ci
dora --format json | jq '.summary'
```

## Links

- [Documentation](https://doraval.thehacksmith.dev) — get started, commands, [memory](https://doraval.thehacksmith.dev/concepts/memory/)
- [npm](https://www.npmjs.com/package/@hacksmith/doraval) · [JSR](https://jsr.io/@hacksmith/doraval) · [Releases](https://github.com/saif-shines/doraval/releases)
