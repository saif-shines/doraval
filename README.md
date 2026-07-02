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

# 5. Judge skill quality — fast, no sessions needed
doraval judge ./skills/my-skill/

# 6. Measure real adherence once agent sessions exist
doraval drift
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
to install Bun v1.3.14 into: ~/.cache/doraval/bun

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
| `agentskills:skill` | `SKILL.md` | The open [agentskills.io](https://agentskills.io/specification) spec: required `name`/`description`, name-matches-directory, length caps, progressive-disclosure token/line budgets |

### `claude new` / `cursor new` / …: scaffold by construction

Interactive wizard for skills and plugins. Targets the coding agent you use — or the one your team and community run.

```bash
doraval claude new                              # interactive
doraval claude new --yes --intent distribute my-plugin   # ship to others
doraval claude new --yes --intent self my-context        # personal / team
doraval cursor new / doraval codex new / doraval copilot new
```

### `skill validate` / `skill lint`: structure vs. LLM quality read

```bash
doraval skill validate ./skills/my-skill/   # structural check, no LLM
doraval skill lint ./skills/my-skill/       # LLM-based clarity/contradiction check
```

`lint` catches what schema checks can't: vague triggers, self-contradicting steps, unclear guardrails.

### `judge`: is the skill well-authored?

One LLM call against a best-practices rubric — no sessions needed. Point it at a skill directory, get a **PASS / FAIL** verdict with a per-criterion checklist.

```
[PASS] Rubric alignment
All mandatory criteria met: activation phrase, ordered steps, imperative voice,
code examples, and explicit MUST / MUST NOT guardrails.
```

```bash
doraval judge ./skills/my-skill/
doraval eval  ./skills/my-skill/   # alias
doraval evals ./skills/my-skill/   # alias
```

### `drift`: did the agent actually follow the skill?

`judge` checks the document. `drift` checks reality: it reads real session transcripts, finds which skills were invoked, and runs an LLM judge per instruction — **ALIGNED / DRIFTED / JUSTIFIED / UNCLEAR** — with evidence citations.

```
Session a1b2c3 "Design a new feature"
  ✓ ALIGNED     Invoke the skill before responding
  ↗ DRIFTED     Run git log for churn signal          (no git log call found)
  ~ JUSTIFIED   Check 4 repos                          (only 2 repos match scope)

Aggregate drift rate: 1/8 binding instructions drifted (12%)
```

```bash
doraval drift ./skills/my-skill/   # one skill, all matching sessions
doraval drift --session <id>       # one skill, one session
doraval drift                      # repo sweep — every discovered skill, ranked by drift rate
doraval drift --verbose
```

Both need a judge LLM configured — `doraval init` sets this up, or run `doraval evals setup` on its own. See [judge docs](https://doraval.thehacksmith.dev/commands/judge/) and [drift docs](https://doraval.thehacksmith.dev/commands/drift/).

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
doraval validate . --for claude --format json --ci
doraval skill validate ./my-skill/ --format json --ci
doraval judge ./my-skill/ --format json --ci
doraval drift --format json --ci
```

Exits with code `1` when errors are found. Pipe `--format json` to `jq` or consume programmatically.

## Providers

Claude Code, Cursor, Codex, Copilot CLI, and Grok validators and scaffolding built in. OpenCode support is experimental. The open [agentskills.io](https://agentskills.io/specification) SKILL.md spec is validated as a standalone profile (`agentskills:skill`) — no packaging/manifest concept, just the skill file itself.

## Links

- [Docs](https://doraval.thehacksmith.dev): [What is doraval?](https://doraval.thehacksmith.dev/get-started/), [Quickstart](https://doraval.thehacksmith.dev/get-started/quickstart/), command reference
- [JSR package](https://jsr.io/@hacksmith/doraval)
- [npm package](https://www.npmjs.com/package/@hacksmith/doraval)
- [GitHub Releases](https://github.com/saif-shines/doraval/releases)