# Doraval — work pin (resume here)

> **Pinned:** 2026-07-14 · HEAD `5d1283e` (pin) / work through `64d0f37` · version **0.6.0**  
> **Branch:** `main` · **12 commits ahead of `origin/main` (not pushed)**  
> **Policy:** no more version bumps until an explicit release; batch ships as 0.6.0.

## Track pause: Exceptional CLI

CLI dogfood track is **parked**. Do not start B36+ unless asked.

| Item | State | Notes |
|---|---|---|
| Copilot `dora bump` nesting | **done** | `dd81489` |
| **B33** remove `dora journal` | **done** | migrate + `memory context` + CHANGELOG; v0.6.0 |
| **B34** preflight / stages / large-N | **done** | `9857e8a` `474ca2c` `64d0f37` |
| **B35** type/intent hints + preview | **partial** | core path done; provider-wrapper carryover → B38 |
| **B36–B40** | **paused** | next when CLI track resumes: **B36** reconcile UX |
| Q1 providers identity / Q2 provider groups | **open** | product decisions, not coded |

### B33 residuals (not blocking CLI)

- `apps/website/` still documents journal → B26/B27
- `src/core/journal-config.ts` kept on purpose (shared doraval config / eval paths)
- Installed SessionStart hooks: change `dora journal context --json` → `dora memory context --json` by hand

### Local-only plan docs (`docs/` is gitignored)

- `docs/EXCEPTIONAL-CLI-PLAN.md` — ship notes for B33/B34/B35
- `docs/progress/WIP.md` — older session notes (partially refreshed)
- `docs/superpowers/plans/2026-07-14-remove-journal-b33.md`
- `docs/superpowers/plans/2026-07-14-preflight-progress-b34.md`

This **STATUS.md is the tracked pin** — prefer it over gitignored docs when resuming on another machine.

## Resume prompts

**Resume CLI track:**

```
Read STATUS.md. Resume Exceptional CLI dogfood at B36 (reconcile human labels + judgment Next block) from docs/EXCEPTIONAL-CLI-PLAN.md. No version bump.
```

**Continue non-CLI (ponytail / repo conditions):**

```
Read STATUS.md. CLI track stays paused. Use ponytail (YAGNI ladder): improve repo agent conditions / lean the codebase. Prefer deletion and reuse over new surface. No version bump.
```

## Verify before coding

```bash
git log --oneline origin/main..HEAD   # expect ~11 commits if not pushed
node -e "console.log(require('./package.json').version)"  # 0.6.0
bun test                              # was 601 pass at pin time
bunx tsc --noEmit 2>&1 | grep -c "error TS"  # baseline 271, pre-existing
```

## Next release (when you ask)

Push `main` and publish **0.6.0** as one batch (bump fix + B33–B35). Do not mint 0.6.1/0.7.0 for polish.
