# Dora Rules — Design Spec

**Date:** 2026-07-20
**Status:** Approved design, ready for implementation plan

## Summary

Add a first-class, coded **rule** system to `dora`. Every quality check the review
engine performs — existing structural, heuristic, LLM, and session checks, plus new
best-practice rules — becomes an entry in a central registry with a stable numeric
code and a memorable human slug. Developers toggle rules on/off and override their
severity, either globally or per-project, and select a **package** (a named preset
of rules) as a base layer. Every finding links back to a generated reference page,
giving the "clear reference documentation, links go back to it" experience.

The model deliberately mirrors linter prior art — Ruff (code) and Vale (prose) —
both of which converged on *rules* grouped into selectable sets. Dora lints agent
*context* (prose-shaped), so the Vale analogy is especially close.

## Goals

- One central registry: every check is a coded, documented rule. The registry *is*
  the reference catalog.
- Toggle rules on/off with an optional severity override.
- Global defaults and per-project overrides, with no file added to the user's repo.
- Named packages (presets) as composable base layers, extensible to user-authored
  packages later.
- Every finding links back to a per-rule reference doc.
- Safety-critical checks cannot be disabled.

## Non-goals (deferred)

- User-authored rule files (design the directory + code scheme so this *can* land
  later; ship built-ins only now).
- Committed/team-shared repo config file (per-machine config only for now).
- Domain packages (`claude-skills`, `mcp`) — ship after core rules exist to fill them.
- Multi-package union (one package is the base; switching replaces it).
- Renaming the internal `info` severity enum (display-only "FYI" instead).
- Per-dimension LLM prompt shaping (data-driven `buildLintPrompt`) — post-filter
  suppression now; coarse call-skipping for token savings (see §7.1).
- Renaming the internal `JournalConfig`/`journal:` symbols to "memory" (out of scope;
  spec tracks current code).

## Terminology

- **Rule** — one quality check. Has a code, a slug, a tier, a default severity,
  optional `locked`, a doc URL, and a run function.
- **Code** — stable permanent identifier, e.g. `R012`. Never changes. Doc anchor.
- **Slug** — memorable human handle, e.g. `description-length`. What users type.
  Renamable without breaking config/links (code is the anchor).
- **Package** — a named list of rule codes shipped as a file, e.g. `recommended`.
- **Override** — a per-rule adjustment layered on top of a package: turn off, or
  turn on and set severity.

## Section 1 — Rule registry & data model

```ts
interface Rule {
  code: string          // "R012" — stable anchor, never changes
  slug: string          // "description-length" — memorable handle
  title: string         // short human title
  tier: "structure" | "heuristic" | "llm" | "session"
  defaultSeverity: "error" | "warning" | "info"   // "info" renders as "FYI"
  locked?: boolean      // safety guards — cannot be disabled
  docUrl: string        // /reference/rules/R012
  run: (ctx) => Finding[]   // the wrapped check function
}
```

- `run` is the per-rule producer for tiers where each rule *is* its own function
  (structure, heuristic). For **shared-call tiers** (LLM's five lint dimensions, the
  scenario pass), the rule does not own an isolated `run`; instead its `code`/`slug`
  tag the findings a shared judge call emits, and enable/disable is applied as
  described in §7.1. The interface models this with an optional producer plus a
  `source` discriminator rather than forcing every rule to be a standalone function.
- Registry lives in `src/core/rules/registry.ts` and lists every rule. This is the
  single source of truth for both the engine and the generated docs.
- Codes are allocated sequentially `R001…` across all tiers. Tier is a field, not
  encoded in the code, so a check that moves tiers keeps its code.
- `ReviewFinding` (`src/core/review.ts:23-36`) already has optional `code`/`docUrl`;
  these become always-populated, plus a `slug` field.

## Section 2 — Config storage & resolution

All state lives in `~/.doraval/config.yml`. No file is added to the user's repo.

A shared `RulesConfig` shape is reused at both scopes:

```ts
interface RulesConfig {
  package?: string;                         // base preset name
  overrides?: Record<string, RuleOverride>; // keyed by slug (or code)
}
type RuleOverride = "on" | "off" | "error" | "warning" | "fyi";
```

**Override grammar** (the full value set):

- `off` — disable the rule.
- `on` — enable at its default severity (used to switch on a rule the package omits).
- `error` | `warning` | `fyi` — enable *and* set severity. (`fyi` is the accepted
  token; it maps to the internal `info` enum.)

Global default (new top-level `rules:`):

```yaml
rules:
  package: recommended
  overrides:
    body-size: off
    trigger-clarity: error
```

> **Terminology note:** the product surface calls this subsystem **memory**
> (`dora memory`, the `memory/` command dir, `concepts/memory` docs), but the
> internal config type is still `JournalConfig` and the on-disk YAML key is still
> `journal:` (`journal-config.ts:36-48`) — no code rename has happened. This spec
> uses "memory" in prose and the real `journal.*` symbols when pointing at code.

**Per-project — important:** `journal.projects` is keyed by *sanitized project
name*, not by path (`journal-config.ts:39`); the directory lives in
`mapping.source_dir`. Per-project rules therefore hang off the `ProjectMapping`
object, not a path key. `ProjectMapping` (`journal-config.ts:8-20`) gains an
optional `rules?: RulesConfig`:

```yaml
journal:
  repo: ...
  projects:
    doraval:                    # sanitized NAME, not a path
      remote_path: ...
      local_path: ...
      source_dir: /Users/saif/Experiments/doraval
      rules:
        package: strict
        overrides:
          scenario-coverage: off
```

**Project detection** reuses the existing `resolveProjectName(config, cwd)`
(`journal-config.ts:122`): exact match on `source_dir === cwd`, with the legacy
basename fallback. There is deliberately **no ancestor-directory walk** — matching
how every other dora command resolves the active project. If the cwd resolves to no
registered project, only global rules apply (per-project layer is skipped).

Resolution order (later wins):

1. Rule `defaultSeverity` and built-in package membership.
2. Global `rules.package` → the union of its codes = the enabled set.
3. Global `rules.overrides`.
4. Project `rules.package` (if set, replaces the base package).
5. Project `rules.overrides`.
6. `locked` rules force-enabled last; **both** disable and severity-demotion
   attempts on a locked rule are warned and ignored (a locked safety rule can't be
   turned off *or* quietly demoted to FYI).

The engine computes an **effective config** once per run:
`Map<code, { enabled: boolean; severity }>`. Override keys accept slug or code
(both resolve); stored as slug for readability. A config with no `rules:` section
falls back to the `recommended` package.

## Section 3 — Packages (built-in presets)

A package is a named list of rule codes, shipped as a file in
`src/core/rules/packages/`. User-authored packages use the same format later.

```yaml
# packages/recommended.yaml
name: recommended
description: Sensible defaults for most agent-context files
rules: [R001, R002, R005, R012, R018]
```

Built-in packages at launch:

- **recommended** (default) — opinion checks at default severity, excludes the
  noisy/strict ones. Reproduces today's behavior as closely as the curated set allows.
- **strict** — every rule on, severities bumped where sensible.
- **minimal** — safety `locked` rules plus a couple of structural checks. "Just
  don't let me ship broken context."

Composition: one package is the base; `overrides` layer on top. Switching package
replaces the base (no multi-package union at launch). `locked` safety rules are
implicit members of every package and cannot be excluded.

## Section 4 — CLI UX (`dora rules`)

Bare command opens an interactive, filterable checklist (matches the existing
`review`/`config` interactive hubs):

```
Package: recommended          Scope: project (/Users/saif/…/doraval)

[x] R012  description-length      warning   frontmatter description length
[ ] R018  body-size              warning   SKILL.md body over budget
[x] R003  no-injection      🔒 error     frontmatter injection scan (locked)
[x] R027  scenario-coverage      FYI       scenarios.yaml coverage
      ↑↓ move · space toggle · s severity · p package · ⏎ save · q quit
```

Args make it scriptable:

```
dora rules list [--package X] [--json]
dora rules on  description-length
dora rules off body-size
dora rules set trigger-clarity severity=error
dora rules package strict
dora rules explain description-length     # rule details + doc URL
--project / --global    # scope (default: project if in one, else global)
```

- Disabling a `locked` rule is refused with a warning:
  `R003 no-injection is locked (safety). Cannot disable.`
- `explain` prints title, what/why, default severity, current effective state, doc URL.
- Rules accept slug or code interchangeably.

## Section 5 — Reference docs

New section `apps/website/content/reference/rules/`:

- `index.mdx` — the catalog table: every rule with code · slug · tier · default
  severity · package membership · one-line summary. Auto-generated from the registry
  so docs never drift from code.
- One page per rule: `/reference/rules/R012`, titled `R012 · description-length`,
  with sections **What** it checks, **Why** it matters, **How to fix**, default
  severity, package membership, and `locked?`.

Link-back loop: every CLI finding prints its `docUrl` (`/reference/rules/R012`).
`src/core/doc-registry.ts` (`BASE` at `:8`) already does this for error codes;
extend it for rules. `reference/meta.ts` gains a `rules` entry alongside `scenarios`.

Generation: `scripts/gen-rule-docs.ts` runs in build/CI. The registry is the single
source of truth; the catalog and per-rule metadata block are generated, while the
hand-written What/Why/Fix prose in each per-rule mdx is preserved across regen.

## Section 6 — Wiring & migration

Migrating existing checks into the registry:

- Wrap each `check*` function (`skill-validate.ts:108-230`,
  `static-skill-checks.ts:22-89`), each LLM category (`skill-lint.ts:16`), and each
  session code (`sess-001..006`) as a `Rule` with an assigned code + slug.
- Assign codes `R001…` sequentially and freeze the mapping. A registry test asserts
  codes never shift.
- **Session codes are re-coded** to `R0xx` and the `sess-*` identifiers are retired
  (removed from `doc-registry.ts:44-49`). No alias/shim — consistent with the
  pre-launch, no-users stance. Their doc links move from the generic tiers page to
  their own per-rule pages.
- `locked` safety set (~3–4 rules): frontmatter injection scan
  (`checkFrontmatterInjection` `:183`), YAML/frontmatter parse, script-security scan.

Engine change (`review.ts`):

- Before each tier, consult the effective-config map.
- Skip disabled rules where cheaply possible (see §7 for the LLM tier's coarse-vs-
  fine token behavior).
- On emit: stamp `code`, `slug`, `docUrl`; apply the severity override.
- `docUrl` is stamped **directly from `Rule.docUrl`** (a new `RULE` base,
  `${BASE}/reference/rules/`), *not* routed through `doc-registry`'s prefix logic —
  `R012` has no `-`, so the `code.split("-")` prefix lookup (`doc-registry.ts:63`)
  would not resolve it. `doc-registry` stays for `E-*`/`sess-*`/provider links.
- Positional ids (`struct-NNN`) remain internally; `code`/`slug` become the stable
  public identity on every finding.

Flag interactions:

- `--fail-on` operates on the effective (post-override) severity — unchanged surface.
- `--quick` still skips tiers 3–4 regardless of rule config.

Severity display: `info` renders everywhere as **FYI**; the override token accepts
`fyi` as an alias of `info`. The internal enum is unchanged (no breakage to
`--fail-on` or existing configs).

Rollout: no migration shim (pre-launch, no users). Default `package: recommended`
reproduces today's behavior; configs without `rules:` fall back to it.

## Section 7 — Deep findings & resolved edge cases

Discovered while reading the actual code paths; each closes an ambiguity in the
sections above.

### 7.1 LLM tier — coarse vs fine granularity

The LLM tier is **two judge calls**, not one:

- `buildLintPrompt` (`skill-lint.ts:67`) emits five hardcoded dimensions —
  clarity, actionability, contradiction, trigger, scope — as numbered prose.
- `coverage` is a **separate** scenario-coverage pass (`buildScenarioPrompt` +
  `runJudge`, `review.ts:320-347`).

Consequences for toggling:

- **Per-dimension disable = post-filter suppression.** Disabling e.g. `trigger` does
  not rewrite the lint prompt (the five dimensions are hardcoded prose); the finding
  is dropped after the call. No per-dimension token saving — acceptable, since the
  five share one call.
- **Coarse skips do save tokens.** If *all five* lint dimensions are disabled, skip
  the lint call entirely. If `scenario-coverage` is disabled, skip the scenario
  judge call entirely (it is already a standalone call).
- Rewriting `buildLintPrompt` into a data-driven dimension list (for true
  per-dimension prompt shaping) is explicitly **out of scope now** — noted as a
  future optimization.

The LLM `LintFindingSchema` severity enum is `error|warning|info`
(`skill-lint.ts:15`), so the FYI display mapping applies uniformly here too.

### 7.2 `dora rules --project` when cwd is not a registered project

`resolveProjectName` returns `null` for an unregistered cwd. In that case a
`--project`-scoped write has nowhere to live (no `journal.projects[name]` entry).
Behavior: **refuse and guide** — print
`Not a registered project. Register it first (dora memory setup) or use --global.`
The command never auto-creates a half-populated project entry.

### 7.3 `pass` severity rules

Some checks emit `severity: "pass"` (e.g. drift, `review.ts:225`) — the "ran, found
nothing" green line. `enabled/disabled` governs whether the rule runs at all;
disabling one just removes its green line. The severity **override** grammar
(`error|warning|fyi`) applies only to non-pass emissions; a `pass` result is never
re-leveled.

### 7.4 Memory principles stay out of rule scope

`checkPrinciplesAgainstContent` (`memory-rubric.ts:68`) and the judge's
`rubricSection` injection (`skill-lint.ts:78-80`) enforce team **principles**, which
already have their own on/off and severity model (`status: active|superseded|retired`
and `weight ≥ 7 → error`). The *enforcement check itself* becomes a single rule
(e.g. `principle-adherence`, toggleable); the **individual principles remain data**
governed by the memory subsystem, not converted into rules. No change to the
principle weight/status mechanism.

### 7.5 Doc-gen prose preservation

Per-rule mdx mixes generated metadata with hand-written prose. The generator
rewrites only the region between explicit HTML-comment markers:

```
<!-- DORA:GENERATED:START -->
... code · slug · tier · default severity · package membership (regenerated) ...
<!-- DORA:GENERATED:END -->
```

Everything outside the markers (the What / Why / How-to-fix prose) is preserved
verbatim across regeneration. A missing marker pair on an existing page is a
generator error, not a silent overwrite.

## Testing

- **Registry:** codes unique and frozen; every rule has a doc page; locked rules
  cannot be disabled.
- **Resolution:** package + override + project layering precedence.
- **Engine:** disabled rule emits nothing; severity override applied; locked
  override ignored and warned.
- **CLI:** `on/off/set/package/list/explain`; interactive save round-trips config.
- **Doc-gen:** generated catalog matches the registry.
