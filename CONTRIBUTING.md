# Contributing to doraval

## Setup

```bash
bun install --frozen-lockfile
bun run dev -- --help    # run the CLI from source
```

Requires Bun ≥ 1.3.0 (see `engines` in `package.json`).

## Before you send a PR

```bash
bun test           # 615+ tests must pass
bun run typecheck  # baseline has pre-existing errors; don't add new ones
```

CI (`.github/workflows/test.yml`) runs `bun test` on Linux, macOS, and Windows. The matrix must be green.

## Code philosophy

Read `AGENTS.md` first. It has the ponytail ladder (YAGNI → reuse → stdlib → installed deps → shortest form → minimum code) this codebase is written against. In short:

- Deletion and reuse beat new surface. Don't add an abstraction for one caller.
- Non-trivial logic gets one small test, not a suite.
- Never skip trust-boundary validation, data-loss error paths, or security handling.

## Commits

Conventional Commits style (`fix:`, `feat:`, `docs:`, `chore:`), matching `git log` and `CHANGELOG.md`. Keep the subject under ~70 chars; explain *why* in the body when it isn't obvious from the diff.

## Version bumps

Don't bump the version in a PR. Releases are cut by maintainers via `bun run bump` / `bun run release` (see `WIP.md` for current release status and policy).

## Filing issues

Prefer `dora report` from inside a project using doraval. It drafts a sanitized issue (no env values, no secrets) with the diagnostic payload maintainers need. Manual issues are fine too.

## Website docs

Canonical user docs live in `apps/website/content/` (MDX). When writing or editing them:

1. Follow the style prompt in `apps/website/.devex-kit/style-prompt-block.md` (or load the `docs-writing-style` skill in review mode).
2. Prefer website MDX over `docs/developer-journey.md`. The journey file is product narrative with a command rename map at the top; it is not shipping user docs.
3. Open every page with 1–3 sentences of prose before the first code fence. Command pages need options, common mistakes, and related links.

## Where things live

| Area | Path |
|---|---|
| CLI commands | `src/cli/commands/` |
| Validators (per agent: claude/codex/cursor/copilot) | `src/validators/` |
| Core logic (review, fix, scaffold, memory) | `src/core/` |
| Provider specs (manifest paths, adapters) | `src/providers/` |
| Website / docs | `apps/website/` |
| Docs style prompt | `apps/website/.devex-kit/style-prompt-block.md` |
