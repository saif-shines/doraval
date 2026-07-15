# WIP — Doraval work tracker (resume here)

> **Pinned:** 2026-07-15 · version **0.6.4** (tagged, released) · npm install **fixed** (all five platform packages published across 0.6.1–0.6.4, no further incidents)  
> **Branch:** `main` · clean · Q1/Q2 CLI decisions implemented + released (0.6.3)  
> **Policy:** no more version bumps until an explicit release.  
> **Plan:** [`docs/EXCEPTIONAL-CLI-PLAN.md`](docs/EXCEPTIONAL-CLI-PLAN.md) (v9 + dogfood B33–B40; Q1/Q2 closed)  
> This is the **only** progress pin — do not recreate `STATUS.md`.
>
> **Resumed 2026-07-15:** CLI track un-paused per user request. Done today (no version bump, tests+tsc green, baseline 214 pre-existing tsc errors unchanged):
> 1. Fixed stale `CHANGELOG.md` — added missing 0.6.1–0.6.4 sections; moved provider-groups/`dora completion` removal out of "Unreleased" into 0.6.3 where it actually shipped.
> 2. Fixed real `fix-engine.ts` bug — mechanical `add_field` fix wrote a literal `description: TODO` placeholder into SKILL.md for any missing field; now only the safely-derivable `name` field (from dir name) is mechanical, everything else routes to judgment. Also reworded `checkName`'s warning (`skill-validate.ts`) from "No" to "Missing" so it's consistently wired as fixable — this is the one case that's actually safe to auto-fix.
> 3. Consolidated provider scaffold TODO(010) — `ProviderAdapter.detectContext`/`.scaffold()` and the `Decision`/`ScaffoldResult`/`ProviderContext` types in `src/providers/types.ts` were 100% dead code (never called; real scaffold path is `new.ts` → `scaffold-wizard.ts` → `scaffold.ts`). Deleted the stubs, the unused `resolveAdapter` export, and the two `TODO(010)` comments instead of building the "shared scaffold" wiring the TODO asked for — nothing calls it.
> Next: `docs/backlog.md` + resume `docs/EXCEPTIONAL-CLI-PLAN.md`.

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
| Stash `--fzf` stretch | **deferred** | picker already capped at 20 (B34); fzf optional P2 |

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

**Latest tagged:** `v0.6.4` (2026-07-14). Full npm surface OK: main + five platforms + JSR + GH Release + Homebrew. See `CHANGELOG.md` for the 0.6.1–0.6.4 breakdown (was missing until this session — provider-groups/`dora completion` removal had been sitting under "Unreleased" despite shipping in 0.6.3).

## Next (no version bump)

- **B26 README** — **done** (scan-first, ~116 lines, command table, current 0.6.x surface)
- **B27 website redesign** — **done** (Starlight → Blume; scan-first IA; static `llms.txt` + raw `.md`; Ask AI/MCP deferred)
- Q1/Q2 **implemented + released** (0.6.3): providers = packaging/spec; provider groups deleted
- `src/providers/index.ts` TODO(010) — **done 2026-07-15** (dead scaffold stubs deleted, not consolidated — nothing called them)
- `src/core/review.ts:351` — tier 4 session-adapters integration still a stub (only Claude + Grok session adapters exist; B20–B22 Codex/Copilot/Cursor session adapters never built — real gap, not yet picked up)
- `src/validators/claude/memory.ts:51` — more rules to add incrementally (open-ended, not urgent)
- Optional: stash `--fzf` stretch

### B19 doc registry — **done 2026-07-15**

`src/core/doc-registry.ts`: `getDocUrl(code)` maps `DoravalError` code prefixes (E-JRN/E-PRE/E-NET/E-CFG/E-SCF/E-VAL) to real, already-published `doraval.thehacksmith.dev` pages (verified against `apps/website/content`, not fabricated); `getProviderDocUrl(provider)` maps claude/codex/cursor/copilot to the external docs already vetted in `AGENTS.md`. Wired into `errors.ts` (`DoravalError` auto-populates `docUrl` from the registry unless explicitly set) and `out.ts` (`guidedError` gets its own `Docs:` line — previously `emitError` was smuggling `docUrl` into the `next:` action slot, so it never rendered correctly; also `docUrl` was never populated anywhere before this). Verified end-to-end via `dora review --deep` on a no-judge machine — real `Docs:` line prints.

Not done (would need touching every validator's `CheckItem`, bigger surface): per-rule `(provider, validator, rule)` → docUrl on structural/heuristic findings themselves (`ReviewFinding`/`CheckItem.code` exists but nothing populates it). Left for later, scoped correctly if picked up.

Also found while wiring this: `E-PRE-001`/`E-PRE-002` codes mean different things in different files (`memory-sync.ts` uses 001=gh-missing/git-missing, 002=gh-not-authenticated; `review.ts`/`memory-file-review.ts` use 002=judge-missing) — codes aren't globally unique per meaning. Not fixed (renumbering touches multiple call sites + would need checking nothing keys off the exact number); flagging in case it bites later.

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
