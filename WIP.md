# WIP — Doraval work tracker (resume here)

> **Pinned:** 2026-07-14 · version **0.6.0** · dogfood B33–B39 + B40 partial · push/tag to ship
> **Branch:** `main` · synced with origin after v0.6.0 push (local fixes may be ahead)  
> **Policy:** no more version bumps until an explicit release; batch ships as **0.6.0**.  
> **Plan:** [`docs/EXCEPTIONAL-CLI-PLAN.md`](docs/EXCEPTIONAL-CLI-PLAN.md) (v7 + dogfood B33–B40)  
> This is the **only** progress pin — do not recreate `STATUS.md`.

---

## Track pause: Exceptional CLI

CLI dogfood track was parked for ponytail; **B36 executed** by scheduled plan loop. B37–B39 + B40 memory/sessions polish done. Ship as 0.6.0.

| Item | State | Notes |
|---|---|---|
| Copilot `dora bump` nesting | **done** | `dd81489` |
| **B33** remove `dora journal` | **done** | migrate + `memory context` + CHANGELOG; v0.6.0 |
| **B34** preflight / stages / large-N | **done** | `9857e8a` `474ca2c` `64d0f37` |
| **B35** type/intent hints + preview | **partial** | core path done; provider-wrapper carryover → B38 |
| **B36** reconcile UX | **done** | human headlines, actor tags, judgment Next block |
| **B37** config dual surface | **done** | interactive bare config, table get, --format json |
| **B38** provider wrappers + help order | **done** | shared provider-new, Advanced labels, primary-first help |
| **B39** capabilities discoverability | **done** | --help label + stderr banner unless --format json |
| **B40** cold-start (partial) | **done** | memory examples + weight guide; sessions list Next + id col |
| B40 rest | **paused** | stash fzf (already capped), sessions show tool names, bump interactive |
| Q1 providers identity / Q2 provider groups | **open** | product decisions, not coded |

### B33 residuals (not blocking CLI)

- `apps/website/` still documents journal → B26/B27
- `src/core/journal-config.ts` kept on purpose (shared doraval config / eval paths)
- Installed SessionStart hooks: change `dora journal context --json` → `dora memory context --json` by hand

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
- **Release v0.6.0:** GitHub Release + JSR + Homebrew OK; **npm platform packages FAILED** (E404 on PUT for all five `@hacksmith/doraval-*@0.6.0`). Main package **did** publish `0.6.0` but optionalDeps point at missing platform binaries → **broken npm install**. Root cause: NPM token lacks write on platform packages (or npm org ACL); loop previously continued after failures. Workflow hardened to fail-fast (this loop).
- **Action required:** grant NPM_TOKEN write on all five platform packages, re-run Release / re-publish platforms for 0.6.0 (do not re-bump version).

## Release

**Pushed 2026-07-14:** `main` + tag **`v0.6.0`**. Partial publish: main+JSR yes, platform packages no.

## Next release (when you ask)

Push `main` and publish **0.6.0** as one batch (bump fix + B33–B35). Do not mint 0.6.1/0.7.0 for polish.

---


## Ponytail pass (2026-07-14)

Audit + lean fixes (CLI still paused):

- **delete:** unused `openai` package (code uses `@ai-sdk/openai` only)
- **shrink:** stale OpenTUI comments in `out.ts` / `backend.ts`
- **conditions:** `AGENTS.md` rewritten with ponytail ladder + skill routing + WIP pointer

Still not worth doing this pass (named, skip):

- rename `journal-config.ts` → doraval-config (many importers; pure rename PR later)
- collapse `RenderBackend` seam (one impl today; parked for possible `dora ui`)
- website journal pages (B26/B27, large docs track)


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
