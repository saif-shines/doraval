# doraval

**Context engineering for coding agent orchestrators.**

[Documentation](https://doraval.thehacksmith.dev) · [Distributor quickstart](https://doraval.thehacksmith.dev/get-started/quickstart-distributors/) · [Orchestrator quickstart](https://doraval.thehacksmith.dev/get-started/quickstart-orchestrators/)

You write skills, plugins, and team context so agents (and humans) ship on the first try. Then you hand that context to juniors, your community, or your own agent, and watch it fail anyway. Broken manifests. Skills that never trigger. Decisions that drift session to session. "Works on my machine with Claude" does not mean it works for Cursor, Codex, or the ten engineers you just onboarded.

**The problem:** context you cannot trust until someone else has already wasted a day debugging it.

**The win:** validate, scaffold, journal, and measure so the first attempt succeeds across Claude, Cursor, Codex, Copilot, Grok, and whatever comes next.

> **Magic is free. First win in under 2 minutes:**
> ```bash
> # macOS: self-contained binary, no runtime
> brew install saif-shines/tap/doraval
> doraval validate .
>
> # Everyone else: no install required
> npx @hacksmith/doraval validate .
> ```

`validate` auto-detects what you built and tells you what's broken before anyone burns a session on it.

## Who you are

doraval serves two jobs. Pick the path that matches yours:

```
  Context you engineer (skills, plugins, decisions)
                        │
                        ▼
                 ┌─────────────┐
                 │   doraval   │  validate · scaffold · journal · eval
                 └─────────────┘
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
   CONTEXT DISTRIBUTOR          CONTEXT ORCHESTRATOR
          │                           │
   Devtool company              Expert engineer
   shipping skills to           tuning context for
   the community                your own coding agent
          │                           │
   Senior engineer               Journal + hooks inject
   onboarding juniors            decisions before you
          │                      type the first message
          ▼                           ▼
   Ship → users run real        Scaffold → validate →
   sessions → eval judges       journal → hook enable
   adherence per skill
```

| You are… | Your loop | Quickstart |
|---|---|---|
| **Context distributor**, publish skills or onboard juniors | scaffold → validate → ship → `eval` on real sessions | [Distributor guide](https://doraval.thehacksmith.dev/get-started/quickstart-distributors/) |
| **Context orchestrator**, manage context for your own agent | scaffold → validate → journal → hook enable | [Orchestrator guide](https://doraval.thehacksmith.dev/get-started/quickstart-orchestrators/) |

The orchestrator problem, stated plainly: give 10 new engineers (or agents) a skill and only 3/10 succeed on the first try. 4/10 take hours. 7/10 take a day. 10/10 take days. doraval **left-shifts success**: catch breakage before the first session, not after the third debugging thread.

## Install

### macOS (Homebrew, recommended)

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

Requires Node.js. Bun runs faster if installed; Node works fine.

### Bun

```bash
bunx @hacksmith/doraval validate .
bun add -g @hacksmith/doraval
```

`doraval` and `dora` are the same CLI.

## Commands

### `validate`: catch breakage before anyone uses it

Point at a directory or GitHub URL. doraval finds what's there and checks it.

```bash
doraval validate .                                          # local directory
doraval validate https://github.com/obra/superpowers        # remote repo
doraval validate . --for claude           # all Claude validators
doraval validate . --for claude:plugin    # one validator
```

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

### `claude new` / `cursor new` / …: scaffold by construction

Interactive wizard for skills and plugins. Targets the agent your audience actually runs.

```bash
doraval claude new                              # interactive
doraval claude new --yes --intent distribute my-plugin   # distributor
doraval claude new --yes --intent self my-context        # orchestrator
doraval cursor new / doraval codex new / doraval copilot new
```

### `skill validate` / `skill drift`: one skill, two lenses

Structural check vs. rubric deviation:

```bash
doraval skill validate ./skills/my-skill/
doraval skill drift ./skills/my-skill/
```

`drift` measures six rubric areas: trigger phrases, step-by-step structure, imperative voice, examples, guardrails (`MUST` / `MUST NOT`), and clarity.

### `eval`: did the agent actually follow the skill?

`validate` and `drift` check the document. `eval` checks reality: it reads a real session transcript, finds which skills were invoked, and runs an LLM judge for a per-skill **PASS / FAIL** with a dynamic checklist, familiarity score, and closure info (1-shot vs multi-turn vs incomplete).

```bash
doraval eval                    # pick from recent sessions interactively
doraval eval --verbose
doraval judge ./skills/improve/ # alias: eval for one skill
doraval eval history            # past verdicts
```

Requires `doraval init` first. See [eval docs](https://doraval.thehacksmith.dev/commands/eval/).

### `journal`: decision memory that survives sessions

Record project principles so future you (and agents) don't contradict past choices. SessionStart hooks inject the journal before the first message.

```bash
doraval init                  # journal repo + agent config (Claude or Grok)
doraval journal list          # view active principles
doraval journal add "..."     # propose a decision
doraval journal sync          # publish pending entries
doraval journal update        # pull latest from remote
doraval journal hook enable   # inject journal on every SessionStart
```

Requires the GitHub CLI (`gh`). Journal lives in a private GitHub repo you control.

### `ui`: local dashboard

```bash
doraval ui                 # start dashboard (opens browser)
doraval ui --port 4921
doraval ui --status        # check if running
doraval ui --force         # force restart
```

Re-running `doraval ui` is idempotent (PID tracking). Sidebar navigation, loading states, and open-dir support ship in recent releases.

### `config`: dot-notation settings

```bash
doraval config get
doraval config set eval.model claude-sonnet-4-20250514
```

### Other

```bash
doraval update              # self-update to latest
doraval providers           # which agents understand which keywords
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
doraval validate . --for claude --format json --ci
doraval skill validate ./my-skill/ --format json --ci
doraval skill drift ./my-skill/ --format json --ci
doraval eval --ci --format json
```

Exits with code `1` when errors are found. Pipe `--format json` to `jq` or consume programmatically.

## Providers

Claude Code, Cursor, Codex, Copilot CLI, and Grok validators and scaffolding built in. OpenCode support is experimental.

## Links

- [Docs](https://doraval.thehacksmith.dev): distributor and orchestrator quickstarts, command reference
- [JSR package](https://jsr.io/@hacksmith/doraval)
- [npm package](https://www.npmjs.com/package/@hacksmith/doraval)
- [GitHub Releases](https://github.com/saif-shines/doraval/releases)