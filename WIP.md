# WIP — Doraval work tracker (resume here)

> **Pinned:** 2026-07-16 · version **0.6.5** · B20–B22 + residual track shipped  
> **Branch:** `main` · Q1/Q2 closed · multi-agent sessions + memory-file session presence  
> **Policy:** no more version bumps until an explicit release.  
> **Plan:** [`docs/EXCEPTIONAL-CLI-PLAN.md`](docs/EXCEPTIONAL-CLI-PLAN.md) (v9 + dogfood B33–B40; Q1/Q2 closed)  
> This is the **only** progress pin — do not recreate `STATUS.md`.

---

## Session 2026-07-20b — `dora rules` brainstorm (RESUME HERE)

Brainstormed a **coded, toggleable rule system** for dora. Design fully approved
across 6 sections + a deep-findings pass. **Spec written, NOT yet planned/coded. No
version bump.**

### ⚠️ Recovery caveat — spec is UNCOMMITTED

Mid-session the working tree switched `design/dora-rules → main` and wiped my
working-tree patches (they were never committed). Recovered by hand.

- **Live patched spec (357 lines):** `docs/superpowers/specs/2026-07-20-dora-rules-design.md`
  — untracked in working tree on `main` (`docs/` is gitignored → needs `git add -f`).
- **Backups:** scratchpad `dora-rules-spec-original.md` + `dora-rules-spec-FINAL-patched.md`
  (session scratchpad `…/23a18623-…/scratchpad/`).
- `design/dora-rules` branch holds only the **original** unpatched spec (`1dafe15`),
  with two unrelated `docs(website)` commits stacked on top. Do **not** trust that
  copy — the working-tree/scratchpad FINAL is authoritative.
- **First resume action:** decide where to commit the patched spec (recommended: new
  branch off current `main`), then `git add -f` it.

### Decisions (all approved)

- Term is **rule** (over guideline/policy/practice) — Ruff + Vale prior art.
- **Identity:** stable numeric `code` (`R012`, permanent doc anchor) + memorable
  `slug` (`description-length`, what you type). Both resolve. Not concatenated.
- **Scope C:** every existing check (structure/heuristic/llm/session) gets a code +
  becomes a rule; new authored rules join later. Central registry
  `src/core/rules/registry.ts` = single source of truth = the reference catalog.
- **Toggle** = on/off **+ severity override**. Grammar `on|off|error|warning|fyi`.
- Safety guards `locked` = can't disable **or** demote (injection scan, YAML parse,
  script-security).
- **`info` renders as FYI** (display-only; internal enum unchanged).
- **Config** all in `~/.doraval/config.yml` (no repo file): global top-level `rules:`
  + per-project on `ProjectMapping.rules` (projects keyed by sanitized **name**, not
  path; resolve via `resolveProjectName`, no ancestor walk). Project overrides win.
- **Packages** = named code lists shipped as files (`recommended` default / `strict`
  / `minimal`); built-in now, user-authored later; one base + overrides, no union.
- **CLI** `dora rules`: bare = interactive checklist; args `list/on/off/set/package/
  explain` + `--project|--global`.
- **Docs** new `reference/rules/` — generated catalog + per-rule pages; every finding
  stamps `docUrl` from `Rule.docUrl` (new `RULE` base), link-back loop.
- **Deep findings (§7 of spec):** LLM tier is 2 judge calls → per-dimension disable =
  post-filter, coarse skip saves tokens; sess-* re-coded to R0xx (no shim); memory
  principles stay out of rule scope; doc-gen preserves prose between HTML markers.
- Terminology: product says **memory**, code still `JournalConfig`/`journal:` (no
  rename). Spec tracks current code.

### Resume prompt

```
Read WIP.md § Session 2026-07-20b. Spec is UNCOMMITTED — recover from
docs/superpowers/specs/2026-07-20-dora-rules-design.md (working tree, main) or
scratchpad FINAL backup; commit it (new branch off main, git add -f). Then invoke
superpowers:writing-plans on that spec to produce the implementation plan (I execute
plans myself — memory feedback_plan_only). No version bump.
```

---

## Session 2026-07-20 — review UX + judge-architecture rethink

Two things this session: (1) shipped review-UX fixes, (2) brainstormed a
judge-architecture spec ready for a plan. **No version bump.**

### Shipped this session (in tree, UNCOMMITTED — `git status` to see)

| Change | Files |
|---|---|
| `dora review` (bare human TTY) asks **Quick vs Agentic**; agentic w/o judge offers `config setup` | `src/cli/commands/review.ts` (`shouldPromptReviewMode`), `config.ts` (export `runSetupWizard`) |
| Per-skill progress counter in `reviewAll` (`Reviewing N/M · name`); spinner now also on quick `--all` | `src/core/review.ts`, `src/cli/commands/review.ts` |
| **CLI-judge spawn timeout** — `spawnSync` gets `timeout`+`killSignal:SIGKILL` (default 180s, `eval.timeout_ms`), maps kill→actionable error. Fixes the infinite hang when `claude` subprocess blocks. | `src/core/agent-invoke.ts`, `src/core/skill-lint.ts` (threads `timeout_ms` into `lintViaCli`) |
| Tests | `src/cli/commands/review.test.ts` (new), `src/core/agent-invoke.test.ts` (timeout case) |

All green: `bun test src/core` = 578 pass; touched files typecheck clean.

### Brainstormed (spec written, NOT yet planned/implemented)

**Spec:** `docs/superpowers/specs/2026-07-20-judge-architecture-delegate-or-api-design.md`
(APPROVED design, pending user review + writing-plans.)

Core decision: **CLI-spawn judging is the wrong tool — delete it.** Replace with:
- **in-agent → delegate** (Style 1): dora emits a `JUDGE THIS` prompt block; the
  calling model judges inline. Zero keys, zero subprocess.
- **standalone/CI → API** (existing `llm-judge.ts` path). No key → fail clear.
- `eval.judge`: `auto|api|cli` → **`auto|api|delegate`** (drop `cli`).
- `capability-detect` → pure probe `"api"|"none"`; new `resolveJudgeMode({apiAvailable, ci, judgePref})` → `api|delegate|fail`, **discriminated by `--ci`** (agents use `--format json`, so `--ci` — not json — is the "no caller to delegate to" signal).
- **session-eval forced in-scope** (shares the `eval.judge` enum) → convert its
  CLI fallback to API-or-fail.
- Non-goals: OAuth (parked, ToS-gray), models.dev catalog, prompt-gen (left; still
  protected by the timeout above), in-agent merged verdict.

Grounded in a sourced study of `anomalyco/opencode` @ `67caf894` — its own guidance
for a single-call judge = env-key + AI-SDK `create*` switch + `generateObject`, no
subprocess/plugins/OAuth. dora's API path already is that.

The shipped CLI-spawn timeout is a **stopgap**; this spec removes the judge's
CLI-spawn entirely (timeout stays only to guard `prompt-gen`).

### Resume prompt

```
Read WIP.md § Session 2026-07-20. Decide: commit the shipped review-UX work +
spec, then invoke superpowers:writing-plans on
docs/superpowers/specs/2026-07-20-judge-architecture-delegate-or-api-design.md to
produce the implementation plan (I execute plans myself — see memory
feedback_plan_only). No version bump.
```

---

## Track pause: Exceptional CLI

CLI dogfood track was parked for ponytail through 0.6.0; **B36 executed** by scheduled plan loop. B37–B39 + B40 memory/sessions polish done. Shipped as 0.6.0; Q1/Q2 (provider groups deletion, `dora completion` → `--completion` flag) shipped in 0.6.3.

| Item | State | Notes |
|---|---|---|
| Copilot `dora bump` nesting | **done** | `dd81489` |
| **B33** remove `dora journal` | **done** | CLI + migration + CHANGELOG; website residual closed (memory pages, redirects, journal docs removed) |
| **B34** preflight / stages / large-N | **done** | `9857e8a` `474ca2c` `64d0f37` |
| **B35** type/intent hints + preview | **partial** | core path done; provider-wrapper carryover → B38 |
| **B36** reconcile UX | **done** | human headlines, actor tags, judgment Next block |
| **B37** config dual surface | **done** | interactive bare config, table get, --format json |
| **B38** provider wrappers + help order | **done → superseded by Q2** | wrappers deleted 2026-07-14; `dora new --for` only |
| **B39** capabilities discoverability | **done** | --help label + stderr banner unless --format json |
| **B40** cold-start (partial) | **done** | memory examples + weight guide; sessions list Next + id col |
| B40 rest | **done** | sessions list uses `sessionId` (was broken `e.id`); show tool/skill names; interactive bare `dora bump` (multiselect → type → preview → confirm); unit tests |
| Q1 providers identity | **decided → A** | packaging/spec only; repo support = bare `dora` scan |
| Q2 provider groups | **decided → delete** | no `dora claude|cursor|codex|copilot` groups; `dora new --for` only |
| Stash `--fzf` stretch | **done 2026-07-18** | `dora memory stash --fzf`; clack still capped at 20 |

### B33 residuals

- **Website:** journal command pages removed; Memory sidebar + concept + command docs; old journal URLs redirect (2026-07-14)
- `src/core/journal-config.ts` kept on purpose (shared doraval config / eval paths; rename later)
- Installed SessionStart hooks (user machines): change to `dora memory context --json` by hand — documented on memory concept page

### Implementation plans (local; under gitignored `docs/`)

- `docs/superpowers/plans/2026-07-14-remove-journal-b33.md` (shipped)
- `docs/superpowers/plans/2026-07-14-preflight-progress-b34.md` (shipped)

---

## Resume prompts

**Resume CLI track:**

```
Read WIP.md. After release: remaining B40 (bump interactive, sessions show detail) or website B26/B27 from docs/EXCEPTIONAL-CLI-PLAN.md. No version bump.
```

**Continue non-CLI (ponytail / repo conditions):**

```
Read WIP.md. CLI track stays paused. Use ponytail (YAGNI ladder): improve repo agent conditions / lean the codebase. Prefer deletion and reuse over new surface. No version bump.
```

## Verify before coding

```bash
git log --oneline origin/main..HEAD
node -e "console.log(require('./package.json').version)"  # 0.6.0
bun test
bunx tsc --noEmit 2>&1 | grep -c "error TS"  # baseline ~271, pre-existing
```

## Gaps found after 0.6.0 tag

- Test CI Windows failures — **fixed** (`09cb542`); Test green on latest main.
- **npm platform packages @0.6.0** — **FIXED 2026-07-14** via local recovery (GH release binaries → assemble → `npm publish --access public --otp=…`). All five on registry; clean `npm install @hacksmith/doraval@0.6.0` → `doraval --version` = `0.6.0`.
- `NPM_TOKEN` GAT — releases 0.6.1–0.6.4 all published cleanly with no EOTP/E404 repeat, so the token is very likely fixed. Not independently re-verified this session (can't check GH secret scopes from the repo) — if a future release EOTP/E404s again, redo the write + Bypass-2FA grant on all five platform packages (and main).

## Release

**Latest tagged:** `v0.6.5` (2026-07-16). See `CHANGELOG.md`. Prior 0.6.1–0.6.4 npm platform surface was OK; re-verify five platforms + main after this release CI.

## Next (no version bump)

- **B-viii discovery slice** — **done 2026-07-18**: Grok agent surfaces (`.grok/skills|commands`, `.agents/skills|commands`, rules/plugins/agents dirs, `.grok-plugin`); `grok:skill` + `grok:plugin` validators; scan `shadows` (name collisions, Grok priority winner-first) + human “Name collisions”; skill discovery already ignores gitignore.
- **B-ix Grok multi-file sessions** — **done 2026-07-18**: stable `sessionId` from session dir; `summary.json` title/model/cwd/branch; `skillsInvoked` from `Skill <name>` titles + `…/skills/<name>/SKILL.md` paths; long-cwd `.cwd` groups; `GROK_HOME` / `{ grokHome }` override; list skillCount + tokens from signals.
- **B-x Grok headless JSON judge** — **done 2026-07-18**: live `grok 0.2.103` confirmed `--output-format json` → stdout `{ text, sessionId, usage, … }`; default template includes JSON + hygiene flags; stop stripping JSON in `resolveAgentConfig`; `extractCandidates` unwraps Grok `text` (and Claude `result`). `runAgentSession` stays plain.
- **B-xi platform install doctor** — **done 2026-07-18**: `checkPlatformInstall` on scan Intelligence (`install` field); source/dev skip; missing optionalDep fail + reinstall Next; version skew warn; no network, no brotli/home-bin.
- **Memory rule-violation scoring (backlog #9 slice)** — **done 2026-07-18**: extract binding MUST/MUST NOT/NEVER rules (`sess-005`); on `dora review CLAUDE.md --sessions` run `runEval` with `artifactKind: "memory"` on newest session → map DRIFTED to `sess-006+`. Default review still presence + inventory only (no extra LLM cost).
- **Per-finding docUrls (B19 leftover / slice A)** — **done 2026-07-18**: `getFindingDocUrl` + `withDocUrl`; `ReviewFinding`/`HealthItem` optional `code`/`docUrl`; sess-* + scan health + shadow codes stamped; review/scan human render shows `Docs:` under non-pass lines. Validators mass-migration still later.
- **Stash `--fzf` stretch** — **done 2026-07-18**: `dora memory stash --fzf` fuzzy multi-select via fzf (full candidate list); clack path still capped at 20 with hint to `--fzf` when available.
- **Next residual:** explicit release when you want one (no bump until asked).
- **B26 README** — **done** (scan-first, ~116 lines, command table, current 0.6.x surface)
- **B27 website redesign** — **done** (Starlight → Blume; scan-first IA; static `llms.txt` + raw `.md`; Ask AI/MCP deferred)
- Q1/Q2 **implemented + released** (0.6.3): providers = packaging/spec; provider groups deleted
- `src/providers/index.ts` TODO(010) — **done 2026-07-15** (dead scaffold stubs deleted, not consolidated — nothing called them)
- **B20–B22 session adapters** — **done 2026-07-15** (Cursor + Codex + Copilot adapters + mechanical tier-4 evidence engine; `dora review --sessions` now multi-agent)
- **B30 residual (mechanical sessions on memory files)** — **done 2026-07-16**: `reviewMemoryFile` honors `--sessions` / `E-PRE-003`, emits sess-004 presence findings (not skill-invoke matching).
- **B30 / backlog #9 slice (rule-violation scoring)** — **done 2026-07-18**: binding-rule inventory + optional LLM adherence when `--sessions` (see above).
- **E-PRE code collision** — **done 2026-07-16**: 001 tool missing, 002 not authenticated, 003 no sessions, **004 missing LLM judge** (was colliding with 002 on review paths).
- `src/validators/claude/memory.ts` — dead links + duplicate lines added 2026-07-16; more rules still open-ended
- **B18 residual** — **done 2026-07-16**: empty `catch {}` sites annotated `// intentional: …` (JSON probe, teardown, best-effort I/O).
- **B28 residual** — **done 2026-07-16**: `completion-script.test.ts` covers bash/zsh/fish + errors (runs in `bun test` / CI).
- Optional: stash `--fzf` stretch — **done 2026-07-18**

### B19 doc registry — **done 2026-07-15**

`src/core/doc-registry.ts`: `getDocUrl(code)` maps `DoravalError` code prefixes (E-JRN/E-PRE/E-NET/E-CFG/E-SCF/E-VAL) to real, already-published `doraval.thehacksmith.dev` pages (verified against `apps/website/content`, not fabricated); `getProviderDocUrl(provider)` maps claude/codex/cursor/copilot to the external docs already vetted in `AGENTS.md`. Wired into `errors.ts` (`DoravalError` auto-populates `docUrl` from the registry unless explicitly set) and `out.ts` (`guidedError` gets its own `Docs:` line — previously `emitError` was smuggling `docUrl` into the `next:` action slot, so it never rendered correctly; also `docUrl` was never populated anywhere before this). Verified end-to-end via `dora review --deep` on a no-judge machine — real `Docs:` line prints.

Not done (would need touching every validator's `CheckItem`, bigger surface): per-rule `(provider, validator, rule)` → docUrl on structural/heuristic findings themselves (`ReviewFinding`/`CheckItem.code` exists but nothing populates it). Left for later, scoped correctly if picked up.

E-PRE codes (fixed 2026-07-16): `001` missing tool (gh/git), `002` not authenticated, `003` no sessions, `004` missing LLM judge.

### B31 CONTRIBUTING.md — **done 2026-07-15**

Added `CONTRIBUTING.md` (setup, test/typecheck gates, ponytail philosophy pointer to `AGENTS.md`, commit style, no-version-bump rule, `dora report` for issues, where-things-live table). CHANGELOG + checked-in CI were already done; B31 now fully closed.

---


## Ponytail pass (2026-07-14)

Audit + lean fixes (CLI still paused):

- **delete:** unused `openai` package (code uses `@ai-sdk/openai` only)
- **shrink:** stale OpenTUI comments in `out.ts` / `backend.ts`
- **conditions:** `AGENTS.md` rewritten with ponytail ladder + skill routing + WIP pointer

Still not worth doing this pass (named, skip):

- rename `journal-config.ts` → doraval-config (many importers; pure rename PR later)
- collapse `RenderBackend` seam (one impl today; parked for possible `dora ui`)
- website journal pages — closed by B27 Blume redesign


## Validation dedupe (ponytail audit execute, 2026-07-14)

Executed low-risk audit items (no version bump):

1. **MCP factory** — `createMcpValidator` in `src/validators/shared/mcp.ts`; 4 provider mcp.ts files are thin wrappers
2. **Skill factory** — `createSkillValidator` in `src/validators/shared/skill-validator.ts`; codex/cursor/copilot/claude skill.ts thin (claude keeps includeDrift)
3. **loadSkill merge** — single loader + `loadSkillFromDir` alias with SUPPORTING_DIRS
4. **Shared** `DESCRIPTION_MAX_LENGTH` + `estimateTokens` on skill-validate (agentskills re-exports)

Deferred (higher risk / still dual specs): full skill-validate + agentskills profile merge; marketplace/plugin schema tables; pass-message spam.

## Plan design history (Exceptional CLI v1–v7)

Kept for context; not the live queue (see table above).

### Loop prompt (original plan-improvement session)

```
My /goal is prepare a exception implementation plan and product surface to dramatically improvise the current CLI experience and developer documentation of this repository. Explicitly consult all the product, and CLI development related skills help make this perfect document. Ask me questions and think through the usecases, and primarily from outside in perspective and edge cases we need to solve. We keep improvising this document until all the corner cases, and how to implement is all aligned until I am satisfied completely.
```

### What we did (plan sessions)

**Phase 1 — Deep audit**  
Full codebase + product/CLI skills + developer journey + backlog.

**Phase 2–3 — Plan v1–v5**  
CLI UX, command surface, docs, product expansion; `dora check`, `dora port`, native formats, contradiction detection.

**Phase 4 — Plan v6**  
`dora new` types, `dora report`, VHS inventory, zero-prereq core, judge chain, `--cwd` as CI/agent flag.

**Phase 5 — Plan v7**  
Scan depth, AGENTS vs CLAUDE, TUI parked, 6 personas, internal contradictions fixed.

| Metric | Count |
|---|---|
| Document size | 2200+ lines |
| Major decisions resolved | 10 of 12 |
| Implementation items | 27 (4 phases, 8 weeks) |
| Edge cases catalogued | 65+ |
| User personas tested | 6 |

### Still open on the plan doc itself (not coded)

- 2 open questions: session-format research order; eval model default (plan leans cheap API path)
- Audit leftovers: orphaned refs, missing done-criteria in some sections, `dora new agent` detail gap, `dora update --capabilities` unplaced, exit-code-2 inconsistency

### Key files

| File | What |
|---|---|
| `WIP.md` (this file) | Live tracker / resume pin |
| `docs/EXCEPTIONAL-CLI-PLAN.md` | Full plan (local; `docs/` gitignored) |
| `docs/developer-journey.md` | Developer journey |
| `docs/backlog.md` | Product backlog |
| `docs/research-notes/` | Agent internals research |

### Skills useful when resuming CLI work

`cli-developer`, `devrel-tooling`, `nodejs-cli-best-practices`, `improve`, `ponytail` (YAGNI), `karpathy-guidelines`
