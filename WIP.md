# WIP — Doraval work tracker (resume here)

> **Pinned:** 2026-07-16 · version **0.6.5** · B20–B22 + residual track shipped  
> **Branch:** `main` · Q1/Q2 closed · multi-agent sessions + memory-file session presence  
> **Policy:** no more version bumps until an explicit release.  
> **Plan:** [`docs/EXCEPTIONAL-CLI-PLAN.md`](docs/EXCEPTIONAL-CLI-PLAN.md) (v9 + dogfood B33–B40; Q1/Q2 closed)  
> This is the **only** progress pin — do not recreate `STATUS.md`.

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

**Latest tagged:** `v0.6.5` (2026-07-16). See `CHANGELOG.md`. Prior 0.6.1–0.6.4 npm platform surface was OK; re-verify five platforms + main after this release CI.

## Next (no version bump)

- **B-viii discovery slice** — **done 2026-07-18**: Grok agent surfaces (`.grok/skills|commands`, `.agents/skills|commands`, rules/plugins/agents dirs, `.grok-plugin`); `grok:skill` + `grok:plugin` validators; scan `shadows` (name collisions, Grok priority winner-first) + human “Name collisions”; skill discovery already ignores gitignore.
- **B-ix Grok multi-file sessions** — **done 2026-07-18**: stable `sessionId` from session dir; `summary.json` title/model/cwd/branch; `skillsInvoked` from `Skill <name>` titles + `…/skills/<name>/SKILL.md` paths; long-cwd `.cwd` groups; `GROK_HOME` / `{ grokHome }` override; list skillCount + tokens from signals.
- **Next workbench:** **B-x** (headless JSON re-verify for judges) or **B-xi** (platform install doctor) — product-grill: B-x is small judge plumbing; B-xi is install-path insurance after 0.6.x.
- **B26 README** — **done** (scan-first, ~116 lines, command table, current 0.6.x surface)
- **B27 website redesign** — **done** (Starlight → Blume; scan-first IA; static `llms.txt` + raw `.md`; Ask AI/MCP deferred)
- Q1/Q2 **implemented + released** (0.6.3): providers = packaging/spec; provider groups deleted
- `src/providers/index.ts` TODO(010) — **done 2026-07-15** (dead scaffold stubs deleted, not consolidated — nothing called them)
- **B20–B22 session adapters** — **done 2026-07-15** (Cursor + Codex + Copilot adapters + mechanical tier-4 evidence engine; `dora review --sessions` now multi-agent)
- **B30 residual (mechanical sessions on memory files)** — **done 2026-07-16**: `reviewMemoryFile` honors `--sessions` / `E-PRE-003`, emits sess-004 presence findings (not skill-invoke matching). Full rule-violation scoring still backlog #9.
- **E-PRE code collision** — **done 2026-07-16**: 001 tool missing, 002 not authenticated, 003 no sessions, **004 missing LLM judge** (was colliding with 002 on review paths).
- `src/validators/claude/memory.ts` — dead links + duplicate lines added 2026-07-16; more rules still open-ended
- **B18 residual** — **done 2026-07-16**: empty `catch {}` sites annotated `// intentional: …` (JSON probe, teardown, best-effort I/O).
- **B28 residual** — **done 2026-07-16**: `completion-script.test.ts` covers bash/zsh/fish + errors (runs in `bun test` / CI).
- Optional: stash `--fzf` stretch

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
