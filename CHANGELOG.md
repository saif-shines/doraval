# Changelog

## Unreleased

## 0.6.26

### Docs

- Feature release requires docs lockstep (`AGENTS.md`): website, README, and
  the shipped skill must match the binary before tag.

## 0.6.25

### Features

- Session parse is an **Event list** plus a derived summary. Tool call and
  result are paired. Tokens, errors, and `parentId` are set only when the
  log has them.
- Unused and Review read **Skill invoke records** (Claude Skill tool, slash
  command, Grok titles).
- Review (not `--quick`) prints a **Session health** block for token
  pressure: cache-read ≥ 80%, calls ≥ 20, turns ≥ 10. Not a Finding.
- `dora sessions show` prints token totals when known. A short table id
  is enough when it is unique.

## 0.6.24

### Features

- Review and Scan mark **Plugin-owned** Skills (`pluginOwned`, `pluginRoot`).
- After Review, Scan, or `fix` of that Skill, Next is
  `dora review --quick <plugin-root>` and `dora fix <plugin-root> --dry-run`.

## 0.6.23

### Features

- **`dora skill unused`.** Lists Remove candidates. Writes nothing. Scan Next
  points here when R034 exists.
- **Plugin-owned Skills** are omitted from unused. Named `remove` / `restore`
  of a Plugin-owned Skill exits `1`. Next is `dora review --quick <plugin-root>`.
- **`dora agent-help`** labels `skill unused` **read-only**. `skill remove` and
  `restore` stay **writes**.

### Docs

- Unused is listed before remove on README, `/commands`, the shipped skill,
  and R034.

### Chore

- Drop unused `doraemon-face.js` and the raw `test-judge-api` script.

## 0.6.22

### Chore

- Git ignores `.scratch/` so local notes stay off the index.

## 0.6.21

### Docs

- Home and Introduction subtitle: **context-effectiveness CLI**.
- Home hero type is larger.

## 0.6.20

### Features

- **`dora skill remove` / `dora skill restore`.** Review and Scan recommend
  Authored Skills that were never invoked in the Review window and are not
  Recent installs (**R034**). Unique Authored names delete. Global Skills
  Quarantine and Restore. Agents need `--yes` or `--dry-run`. A name clash
  needs `--for`, `--global`, or a path.

### Docs

- Product line is **context effectiveness**, not context engineering.

## 0.6.19

### Features

- **`--help` talks to the Runner.** Opens with the same first loop as the README:
  `npx skills add saif-shines/doraval` then `dora review --quick`.
- **`dora agent-help`.** Live command map: text table, `--json`, and
  `dora agent-help review` drill-in. Each verb is `read-only` or `writes`.
- **`--json`** is an alias for `--format json` on commands that already
  accept `--format`. `--ci` still implies JSON.
- **Unknown command** prints one error and `Next: dora --help` (no help dump).
- **Agent gates.** Detected agents (`CI`, `GIT_TERMINAL_PROMPT=0`, known
  agent CLI env) skip the Scan proceed prompt. Bare `fix` / `reconcile` /
  `memory promote` from an agent exits `2` with a Next line — no write.
  `--brief` is not a write. Humans on a TTY still see confirms.

### Breaking

- **`dora --capabilities` is removed.** Use `dora agent-help --json`.

## 0.6.5

### Features

- **Multi-agent session adapters (B20–B22):** `dora sessions` and
  `dora review --sessions` read Cursor, Codex, and Copilot stores (plus
  Claude Code and Grok). Review tier 4 reports mechanical usage evidence
  per skill: invoked / never invoked / no sessions found. `--sessions`
  exits 2 (`E-PRE-003`) when no recent sessions exist.
- **Memory-file review sessions:** `dora review CLAUDE.md` (and other
  memory files) includes mechanical session presence and the same
  `--sessions` gate.
- **`claude:memory` validator:** warns on dead relative markdown links and
  duplicate instruction lines.

### Fixes

- Prerequisite codes are unique: `E-PRE-004` = missing LLM judge (no longer
  collides with `E-PRE-002` gh auth).
- Review: close `--sessions` + zero-adapters silent-pass gap; mention-regex
  left-boundary so path fragments don’t false-positive.
- Sessions CLI: remove stale “planned” messaging for supported agents.
- Mechanical fix no longer writes placeholder `description: TODO` for
  missing frontmatter fields (only safe `name` derivation).

### Other

- Doc registry: error codes get real Docs: links; CONTRIBUTING.md.
- Shell completion generator covered by unit tests (bash/zsh/fish).
- Empty `catch {}` sites annotated as intentional degradations.
- docs(site): npm, Homebrew, and Bun install paths on homepage / get-started.

## 0.6.4

Release retry only (npm publish recovery from the platform-package
incident); no functional changes since 0.6.3.

## 0.6.3

### Breaking

- **Removed provider groups** `dora claude` / `dora cursor` / `dora codex` /
  `dora copilot` (including `… new` and nested `… bump`). Scaffold only via
  `dora new --for <agent>`; version bumps via top-level `dora bump`.
- **`dora providers` is packaging/spec reference only.** Repo-relative
  “which agents does this project use?” lives on bare `dora` (Agent surfaces).
- **Removed `dora completion` command.** Use root flag
  `dora --completion bash|zsh|fish` (install plumbing, not product surface).

### Other

- Website redesigned on Blume with B27 IA (scan-first navigation).
- Docs splash copy/hero revised; homepage gained agent-driven loop
  instructions and sidebar metadata.

## 0.6.2

- **B26 README rewrite** — scan-first, under 200 lines, current command
  table.
- Website: replaced `dora journal` docs with `dora memory` docs (B33
  finish).

## 0.6.1

- Fixed CI Windows test failures for platform packages and cursor rules.
- Release workflow now fails fast on platform npm publish errors.
- `dora sessions show` improved; `dora sessions list` now prints real
  session IDs (was falling back to a broken `e.id`).
- Documented the npm platform-package publish incident and recovery
  (see `AGENTS.md`).

## 0.6.0

### Breaking

- **Removed `dora journal`.** It shipped fully alongside `dora memory` since
  the B13a memory rework, which was a product bug, not progressive
  enhancement — two systems doing the same job. `dora memory` (capture →
  enforce → promote) is now the only path.

  **Migration is automatic.** The first `dora memory` command you run after
  upgrading converts every legacy journal entry — global and per-project,
  including any drafts that were never synced — into memory format v2, and
  prints a one-time report: how many entries migrated, how many were
  dropped as corrupt (with the reason for each — nothing is silently
  discarded), and how many landed under a `legacy:<project>` tag in global
  memory because their original project directory wasn't recorded. Re-running
  `dora memory` afterwards is a no-op with respect to migration.

  **Command mapping:**
  - `dora journal add` → `dora memory add`
  - `dora journal list` → `dora memory list`
  - `dora journal context` → `dora memory context` (new — same job: CLAUDE.md/AGENTS.md injection, hook JSON output)
  - `dora journal sync` → `dora memory sync` (now a real git clone, not the GitHub Contents API)
  - `dora journal init` / `dora journal update` / `dora journal hook` → no longer needed; memory has no separate init step and no separate hook command

  **If you had `dora journal hook enable` installed:** this migration does
  not auto-rewrite an already-installed SessionStart hook (that would mean
  building a whole new `dora memory hook` command surface no one asked for,
  just to fix a one-line JSON edit). Edit the hook command by hand — in
  `~/.claude/settings.json` (or your project's `hooks/hooks.json`), change
  `dora journal context --json` to `dora memory context --json` under
  `hooks.SessionStart`.

  Version bump is **minor** (`0.5.4` → `0.6.0`), matching this project's
  established pre-1.0 convention for breaking changes (e.g. `0.4.14` →
  `0.5.0` for the compiled-binary distribution rewrite) rather than a major
  bump to `1.0.0`.
