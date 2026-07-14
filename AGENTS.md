# Doraval — agent conditions

## Before you write code (ponytail ladder)

Stop at the first rung that holds:

1. **YAGNI** — Does this need to exist? Speculative = skip, say so in one line.
2. **Reuse** — Already in this repo? Use it.
3. **Stdlib / Bun / platform** — Prefer built-ins over new helpers.
4. **Installed deps** — Use what is already in `package.json`. Never add a dep for a few lines.
5. **One line** — Prefer the shortest correct form.
6. **Only then** — Minimum code that works. Fewest files. Deletion > addition.

Never lazy about: trust-boundary validation, data-loss error paths, security, or understanding the full call path before editing.

Non-trivial logic leaves **one** small test. No version bumps unless the user asks for a release (see `WIP.md`).

## Skills

Look up project/system skills when deciding. Mention 1–2 options to the user when useful.

- CLI surfaces: `cli-developer`, `devrel-tooling`, `nodejs-cli-best-practices`
- Lean code: `ponytail`, `karpathy-guidelines`, `pragmatic-fp`
- Audits: `improve` (plans only — does not implement)

## Product / agent docs (context only — do not derail the task)

- https://code.claude.com/llms.txt
- https://developers.openai.com/llms.txt
- https://docs.github.com/llms.txt
- https://cursor.com/docs/plugins
- https://github.com/openai/skills/tree/main/skills/.curated/openai-docs

## Resume

**Tracker:** `WIP.md` (only progress pin). Exceptional CLI dogfood is **paused**; resume CLI at **B36** only when asked.
