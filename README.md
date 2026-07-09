# doraval

**Scale your AI context for coding agents.** Make your next context work (skills, plugins & more) for your team, community, or self. Context engineering toolkit for AI coding agents.

**doraval** (*dor-uh-val*) blends **Doraemon** and **eval** — gadget-pulling context tools plus session evaluation. The `dora` alias is the same CLI.

[Documentation](https://doraval.thehacksmith.dev) · [Quickstart](https://doraval.thehacksmith.dev/get-started/quickstart/)

You scale AI context — skills, plugins, decisions — so agents (and humans) succeed on the first try. For yourself, your team, or your community. Broken manifests, skills that never trigger, decisions that drift session to session, and "works on my machine with Claude" that fails for Cursor, Codex, or the tenth engineer you onboard.

**The problem:** context you cannot trust until someone has already wasted a day debugging it.

**The win:** scan, review, fix, and remember so the first attempt succeeds across Claude, Cursor, Codex, Copilot, Grok, and whatever comes next.

doraval is the toolkit for **context engineering** — authoring, validating, and evolving reliable context that works the first time.

> **Magic is free. First win in under 2 minutes:**
> ```bash
> # macOS (Homebrew, recommended):
> brew tap saif-shines/tap
> brew trust saif-shines/tap
> brew install doraval
> dora
>
> # Everyone else: no install required
> npx @hacksmith/doraval
> ```

Bare `dora` scans the repo: which agents are configured, every skill's health, and the exact next command to run — zero config, no API key needed.

Typical first run:

```
dora
  doraval v0.4.14

  Agent surfaces
  ✓  claude    CLAUDE.md  .claude/skills
  ⚠  cursor    not configured

  Health
  ✓  .claude/skills/review    valid
  ✗  .claude/skills/deploy    Missing "description"

  Next
  1. dora fix .claude/skills/deploy
  2. dora review --all
```

## Who it's for

Anyone scaling AI context for coding agents — yourself, your team, or your community:

```
  Scale AI context (skills, plugins, decisions)
                        │
                        ▼
                 ┌─────────────┐
                 │   doraval   │  scan · review · fix · memory
                 └─────────────┘
                        │
                        ▼
        yourself · your team · your community
                        │
                        ▼
              first attempt succeeds
```

Same loop everywhere: scan → review → fix → green. [Quickstart →](https://doraval.thehacksmith.dev/get-started/quickstart/)

Give 10 engineers (or agents) a skill and only 3/10 succeed on the first try. doraval **left-shifts success**: catch breakage before the first session, not after the third debugging thread.

## Quickstart

One path whether you are tuning your own agent, onboarding a team, or shipping to a community:

```bash
# 1. Scan — see what you have and what's broken
dora

# 2. Scaffold
doraval claude new --yes --intent self my-context      # personal / team
doraval claude new --yes --intent distribute my-plugin # ship to others

# 3. Review before anyone relies on it (structure + heuristics + LLM when available)
dora review .

# 4. Apply the mechanical fixes (always shows the diff, always asks)
dora fix .

# 5. Record principles dora enforces in every future review
dora memory add "Run tests before shipping skill changes" --weight 8

# 6. Decision journal that persists across sessions
doraval journal add "Validate before shipping skill changes"
doraval journal sync
doraval journal hook enable
```

Full walkthrough: [Quickstart](https://doraval.thehacksmith.dev/get-started/quickstart/)

## Install

### macOS (Homebrew, recommended)

```bash
brew tap saif-shines/tap
brew trust saif-shines/tap
brew install doraval
```

No runtime required. The binary is self-contained.

On some systems, run `brew trust saif-shines/tap` (or `brew trust --formula saif-shines/tap/doraval`) before the install step for the tap to work smoothly.

### npm / npx

```bash
npx @hacksmith/doraval                   # run without installing (scans the repo)
npm install -g @hacksmith/doraval        # or install globally
```

Requires Node.js ≥ 14.18. npm downloads a prebuilt binary for your platform
(macOS arm64/x64, Linux x64/arm64, Windows x64) — no other runtime, no prompts,
works in CI. Alpine/musl users: run from source with Bun (below).

### Bun

If you prefer to manage Bun yourself:

```bash
curl -fsSL https://bun.sh/install | bash   # macOS / Linux
```

After the installer finishes, **restart your terminal** (or run `source ~/.zshrc` / `source ~/.bashrc`), then:

```bash
bunx @hacksmith/doraval
bun add -g @hacksmith/doraval
```

`doraval` and `dora` are the same CLI.

## Commands

### `dora` (bare): scan the repo

Zero-config diagnosis: agent surfaces, skill health, and numbered next actions. Works in any repo, no setup, no API key.

```bash
dora                        # scan from the current directory
dora --format json          # full scan as structured JSON (for coding agents / CI)
dora scan --cwd /path/repo  # explicit form
```

### `review`: the quality gate

Four tiers, later tiers auto-skip when their prerequisite is missing — nothing ever blocks.

```bash
dora review .                          # structure + heuristics (+ LLM tier when a judge exists)
dora review --quick .                  # tiers 1–2 only — fast, CI-friendly
dora review --deep ./skills/my-skill   # require the LLM tier; exit 2 if no judge
dora review --all                      # every skill under the path, aggregate report
dora review CLAUDE.md                  # review a memory file directly (structure + heuristics + LLM)
```

The LLM judge auto-detects: an installed `claude` CLI (your existing subscription) first, API keys second (`OPENAI_API_KEY`, `dora config set eval.*`). Principles recorded via `dora memory` are enforced as review rubric.

Drop a `scenarios.yaml` next to `SKILL.md` (`when` / `expect` / optional `must_not` per scenario) and the LLM tier checks whether the skill actually handles each documented scenario, flagging any it doesn't cover:

```yaml
- when: "deploy with failing tests"
  expect: "refuses and cites the guardrail"
  must_not: "deploys without test pass"
```

### `fix`: close the loop

```bash
dora fix .              # show diffs for mechanical fixes, ask before applying
dora fix . --yes        # pre-approve (agents/CI) — still prints every diff
dora fix . --dry-run    # show what would change, write nothing
dora fix . --brief      # emit an agent-ready prompt for judgment-only issues
```

Exits 1 while fixable or judgment issues remain, 0 when clean.

### `memory`: principles dora enforces, plus stashed artifacts

```bash
dora memory add "never use default exports" --weight 8
dora memory list
dora memory stash notes.md     # copy a gitignored/untracked file into project memory
dora memory stash              # interactive picker over untracked/gitignored candidates
dora memory restore notes.md   # copy it back (diff + confirm, same as `dora fix`)
dora memory sync               # backup to a private git repo (first run creates/clones)
dora memory sync --repo you/dora-memory
```

High-weight principles show up as errors in every future `dora review` on this project. Stashed artifacts survive a clean clone — handy for local notes, scratch configs, or anything git deliberately ignores but you don't want to lose. Warns above 5MB per file, refuses above 50MB (use git-lfs instead).

`memory sync` turns `~/.doraval/memory/repo` into a real git clone (not the GitHub Contents API). First run checks `gh auth`, creates a private `{you}/dora-memory` repo if needed, adopts any local files, then commit + `pull --rebase` + push. Later runs are just sync. Concurrent machines union-merge append-only `principles.md` files.

#### Validators (Claude)

| Validator | Detects | Checks |
|---|---|---|
| `claude:skill` | `SKILL.md` | Frontmatter, body, supporting files, dynamic injection (`!`…`, `$ARGUMENTS`, `${CLAUDE_*}`) |
| `claude:plugin` | `.claude-plugin/plugin.json` | Full manifest schema, path rules, `.claude-plugin/` purity, version pinning |
| `claude:marketplace` | `plugins/` | Plugin directory structure, README, LICENSE |
| `claude:hooks` | `hooks/hooks.json` | 30+ lifecycle events, hook groups, command/http/mcp_tool/prompt/agent types |
| `claude:mcp` | `.mcp.json` | Server entries (stdio or url), env/cwd, substitution detection |
| `claude:lsp` | `.lsp.json` | Per-language command + `extensionToLanguage` map |
| `claude:monitors` | `monitors/monitors.json` | Array entries, unique names, substitution support |
| `claude:subagent` | `agents/*.md` | Frontmatter, disallowed security fields, non-empty body |
| `claude:command` | `commands/*.md` | Frontmatter, body, advanced fields |
| `claude:memory` | `CLAUDE.md` | Non-empty, length limit, `@path` import resolution |
| `agentskills:skill` | `SKILL.md` | The open [agentskills.io](https://agentskills.io/specification) spec: required `name`/`description`, name-matches-directory, length caps, progressive-disclosure token/line budgets |

### `new`: scaffold by construction

One command for skills, rules, agents, and plugins — pick the agent with `--for`.

```bash
dora new                                          # interactive: type → agent → name
dora new skill --for claude --name review-pr --description "Reviews PRs" --yes
dora new rule --for cursor --name no-defaults --description "Never use default exports" --yes
dora new agent --for claude --name explorer --yes
dora new plugin --for codex --name ship-it --yes  # distributable packaging
dora new skill --for claude --native --yes        # local format, not a plugin
```

`dora claude new` / `cursor new` / … still work as thin wrappers; prefer `dora new --for <agent>`.

> The old `validate`, `skill lint`, `judge`/`eval`/`evals`, and `drift` commands were folded into `dora review` (structure = tier 1, heuristics = tier 2, LLM = tier 3; session-adherence analysis returns as the review sessions tier).

### `journal`: decision memory that survives sessions

Record project principles so future you (and agents) don't contradict past choices. SessionStart hooks inject the journal before the first message.

```bash
doraval journal init          # one-time: journal repo + agent config
doraval journal list          # view active principles
doraval journal add "..."     # propose a decision
doraval journal sync          # publish pending entries
doraval journal update        # pull latest from remote
doraval journal hook enable   # inject journal on every SessionStart
```

Requires the GitHub CLI (`gh`). Journal lives in a private GitHub repo you control.

### `sessions`: what your agents actually did

```bash
dora sessions                    # list recent sessions (Claude Code, Grok today)
dora sessions --agent claude     # filter by agent
dora sessions show <id>          # timeline: turns, tool calls, skills invoked
```

Codex, Copilot, and Cursor adapters are planned — `dora sessions` degrades to an honest "not supported yet" message for them today rather than pretending to have data it doesn't.

### `config`: dot-notation settings

```bash
doraval config get
doraval config set eval.model claude-sonnet-4-20250514
```

### Other

```bash
doraval update              # self-update to latest
doraval providers           # which agents understand which keywords
doraval bump                # bump semver in plugin.json / marketplace.json
doraval completion zsh >> ~/.zshrc   # shell completions (bash | zsh | fish)
```

## Options

| Flag | Short | Description |
|---|---|---|
| `--format <type>` | `-f` | `table` (default) or `json` |
| `--for <spec>` | | Target a provider or specific validator |
| `--verbose` | `-v` | Show detailed diagnostics |
| `--ci` | | Machine-friendly output, non-zero exit on issues |

### CI/CD

```bash
npx @hacksmith/doraval review --all --quick --ci     # structural gate, no LLM cost
dora review . --ci                                   # full gate (LLM tier when available)
dora fix . --dry-run --ci                            # fail if auto-fixable issues exist
dora --format json | jq '.summary'                   # scan as JSON
```

Exit codes everywhere: `0` clean · `1` issues found · `2` could not run. Pipe `--format json` to `jq` or consume programmatically.

## Providers

Claude Code, Cursor, Codex, Copilot CLI, and Grok validators and scaffolding built in. OpenCode support is experimental. The open [agentskills.io](https://agentskills.io/specification) SKILL.md spec is validated as a standalone profile (`agentskills:skill`) — no packaging/manifest concept, just the skill file itself.

## Links

- [Docs](https://doraval.thehacksmith.dev): [What is doraval?](https://doraval.thehacksmith.dev/get-started/), [Quickstart](https://doraval.thehacksmith.dev/get-started/quickstart/), command reference
- [JSR package](https://jsr.io/@hacksmith/doraval)
- [npm package](https://www.npmjs.com/package/@hacksmith/doraval)
- [GitHub Releases](https://github.com/saif-shines/doraval/releases)