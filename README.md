# doraval

**Scale your AI context for coding agents.** Make your next context work (skills, plugins & more) for your team, community, or self. Context engineering toolkit for AI coding agents.

**doraval** (*dor-uh-val*) blends **Doraemon** and **eval** — gadget-pulling context tools plus session evaluation. The `dora` alias is the same CLI.

[Documentation](https://doraval.thehacksmith.dev) · [Quickstart](https://doraval.thehacksmith.dev/get-started/quickstart/)

You scale AI context — skills, plugins, decisions — so agents (and humans) succeed on the first try. For yourself, your team, or your community. Broken manifests, skills that never trigger, decisions that drift session to session, and "works on my machine with Claude" that fails for Cursor, Codex, or the tenth engineer you onboard.

**The problem:** context you cannot trust until someone has already wasted a day debugging it.

**The win:** validate, scaffold, journal, and eval so the first attempt succeeds across Claude, Cursor, Codex, Copilot, Grok, and whatever comes next.

doraval is the toolkit for **context engineering** — authoring, validating, and evolving reliable context that works the first time.

> **Magic is free. First win in under 2 minutes:**
> ```bash
> # macOS (Homebrew, recommended):
> brew tap saif-shines/tap
> brew trust saif-shines/tap
> brew install doraval
> doraval validate .
>
> # Everyone else: no install required
> npx @hacksmith/doraval validate .
> ```

`validate` auto-detects what you built and tells you what's broken before anyone burns a session on it.

Typical first run:

```
dora validate .
  dora validate — 1 validator(s)
  Path:  .
  1 validators • 0 errors • 0 warnings
  Claude Skill (claude:skill)
  Status  Check
  ✓  YAML frontmatter present and parseable
  ✓  name: "my-skill"
  ✓  description field present
  ✓  uses dynamic context injection
  ✓ All checks passed.
```

## Who it's for

Anyone scaling AI context for coding agents — yourself, your team, or your community:

```
  Scale AI context (skills, plugins, decisions)
                        │
                        ▼
                 ┌─────────────┐
                 │   doraval   │  validate · scaffold · journal · eval
                 └─────────────┘
                        │
                        ▼
        yourself · your team · your community
                        │
                        ▼
              first attempt succeeds
```

Same loop everywhere: scaffold → validate → journal → eval. [Quickstart →](https://doraval.thehacksmith.dev/get-started/quickstart/)

Give 10 engineers (or agents) a skill and only 3/10 succeed on the first try. doraval **left-shifts success**: catch breakage before the first session, not after the third debugging thread.

## Quickstart

One path whether you are tuning your own agent, onboarding a team, or shipping to a community:

```bash
# 1. Scaffold
doraval claude new --yes --intent self my-context      # personal / team
doraval claude new --yes --intent distribute my-plugin # ship to others

# 2. Validate before anyone relies on it
doraval validate .

# 3. One-time setup (decision memory + agent integration for scaling AI context)
doraval init

# 4. Record decisions that persist across sessions
doraval journal add "Validate before shipping skill changes"
doraval journal sync
doraval journal hook enable

# 5. Measure adherence in real agent sessions
doraval eval
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
npx @hacksmith/doraval validate .        # run without installing
npm install -g @hacksmith/doraval        # or install globally
```

Requires Node.js. If Bun is missing, the wrapper prompts you to install it automatically — no manual setup required. On macOS it also suggests Homebrew as an alternative.

**First-run flow (no Bun installed):**

```
npx @hacksmith/doraval validate .

Bun runtime not found.
doraval will download and run bun.sh/install (fetched over HTTPS from bun.sh / GitHub)
to install Bun v1.2.0 into: ~/.cache/doraval/bun

Install now? [Y/n]
```

Answering **Y** (the default) installs Bun into `~/.cache/doraval/bun` — your shell rc files are **not** modified. Subsequent runs skip the prompt and use the cached Bun directly.

| Environment variable | Effect |
|---|---|
| `DORAVAL_AUTO_INSTALL_BUN=1` | Skip prompt, always install (useful in CI) |
| `DORAVAL_AUTO_INSTALL_BUN=0` | Skip prompt, never install; print guidance instead |

### Bun

If you prefer to manage Bun yourself:

```bash
curl -fsSL https://bun.sh/install | bash   # macOS / Linux
```

After the installer finishes, **restart your terminal** (or run `source ~/.zshrc` / `source ~/.bashrc`), then:

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

Interactive wizard for skills and plugins. Targets the coding agent you use — or the one your team and community run.

```bash
doraval claude new                              # interactive
doraval claude new --yes --intent distribute my-plugin   # ship to others
doraval claude new --yes --intent self my-context        # personal / team
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

`validate` and `drift` check the document. `eval` checks reality: it reads a real session transcript, finds which skills were invoked, and runs an LLM judge for a per-skill **PASS / FAIL** with a dynamic checklist, familiarity score, and closure info.

Example judgment:

```
[FAIL] improve
  familiarity: 2/10  (prompt was very vague)
  ✓ Invoke the improve skill before responding
  ✗ Phase 1: Run git log for churn signal
  ✗ Phase 2: Fan out parallel subagents
  Result: 3/9 checks — stopped after initial recon.
```

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

- [Docs](https://doraval.thehacksmith.dev): [What is doraval?](https://doraval.thehacksmith.dev/get-started/), [Quickstart](https://doraval.thehacksmith.dev/get-started/quickstart/), command reference
- [JSR package](https://jsr.io/@hacksmith/doraval)
- [npm package](https://www.npmjs.com/package/@hacksmith/doraval)
- [GitHub Releases](https://github.com/saif-shines/doraval/releases)