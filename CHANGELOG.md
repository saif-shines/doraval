# Changelog

## Unreleased

### Breaking

- **Removed provider groups** `dora claude` / `dora cursor` / `dora codex` /
  `dora copilot` (including `… new` and nested `… bump`). Scaffold only via
  `dora new --for <agent>`; version bumps via top-level `dora bump`.
- **`dora providers` is packaging/spec reference only.** Repo-relative
  “which agents does this project use?” lives on bare `dora` (Agent surfaces).
- **Removed `dora completion` command.** Use root flag
  `dora --completion bash|zsh|fish` (install plumbing, not product surface).

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
