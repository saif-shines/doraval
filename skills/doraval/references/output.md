# dora — exit codes and JSON

## Exit codes (global contract)

| Code | Meaning | Agent action |
| --- | --- | --- |
| `0` | clean — no issues | proceed / report done |
| `1` | issues found | fix, or surface to the user; do not report done |
| `2` | could not run (internal error / unmet prerequisite) | report the failure and why; never claim a pass |

`--deep` Review exits `2` when no Judge is available. That is "could not run," not clean.

## `dora review --quick --format json`

Top-level value is always an array, even for one artifact.

```jsonc
[
  {
    "path": ".claude/skills/deploy",
    "origin": "claude",
    "tiers": {
      "structure": { "passed": 3, "warnings": 0, "errors": 1, "findings": [/* Finding */] },
      "heuristics": { "passed": 2, "warnings": 1, "errors": 0, "findings": [] },
      "llm": { "available": false },
      "sessions": { "available": false }
    },
    "summary": { "passed": 5, "warnings": 1, "errors": 1 }
  }
]
```

A Finding has `tier`, `severity` (`error` | `warning` | `info` | `pass`), `message`, `fixable`, and optional `code` / `docUrl`.

A Review **without** `--quick` also sets `sessionHealth` on each result: `{ window, sessionCount, signals }`. `signals[].code` is `cache-read` | `call-count` | `turn-count`. Session health is not a Finding. `--quick` omits the key.

### How to branch (Review)

- Any `.summary.errors > 0` → hard failures. Fix before done.
- `tiers.llm.method === "delegated"` → evaluate the emitted `JUDGE THIS` block. `--quick` does not run this tier.
- A clean `--quick` result is structure + heuristics only. No `sessionHealth`.
- On a full Review, read `sessionHealth.signals`. Do not treat those codes as Skill Findings.

## `dora --format json` — Scan shape

```jsonc
{
  "version": "0.6.x",
  "agents": [ /* detected agent surfaces + config files */ ],
  "health": [
    { "path": ".claude/skills/deploy", "status": "fail",
      "errors": [ { "text": "Missing \"description\"", "code": "..." } ],
      "warnings": [] }
  ],
  "contradictions": [
    { "severity": "conflict", "message": "...", "sources": [ { "file": "..." } ] }
  ],
  "summary": { "passed": 3, "warnings": 1, "failed": 1 },
  "intelligence": { "judge": "delegate" },
  "suggestions": [ { "kind": "fix", "command": "dora fix ...", "title": "..." } ],
  "empty": false
}
```

### How to branch (Scan)

- `.summary.failed > 0` → hard failures. Review / Fix before done.
- `.contradictions[].severity === "conflict"` → run `dora reconcile --dry-run`, then ask the user.
- `.health[].status` is `"pass" | "warn" | "fail"` per artifact.
- `.intelligence.judge` is `"api" | "delegate"`. `"delegate"` means evaluate the `JUDGE THIS` block on a later Review (not `--quick`). `--ci` still requires API credentials.

## For hooks

`dora memory context --json` emits the active memory set for injection at session start.
