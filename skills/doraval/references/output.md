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

## `dora scan --json`

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
- `.contradictions[].severity === "conflict"` → run `dora conflicts --dry-run`, then ask the user.
- `.health[].status` is `"pass" | "warn" | "fail"` per artifact.
- `.intelligence.judge` is `"api" | "delegate"`. `"delegate"` means evaluate the `JUDGE THIS` block on a later Review (not `--quick`). `--ci` still requires API credentials.

## `dora fix --json`

```jsonc
{
  "mechanical": 1,
  "applied": 1,
  "judgment": [
    {
      "message": "No guardrails found",
      "severity": "warning",
      "hint": "Guardrail presence (heuristic)",
      "code": "R018",
      "docUrl": "https://doraval.dev/reference/rules/R018"
    }
  ]
}
```

`judgment` is objects, not strings. `hint` is never empty. `code` and `docUrl` are omitted when the Finding has none.

### How to branch (Fix)

- `mechanical` unapplied → `dora fix <path> --yes` (or `--dry-run` first).
- `judgment.length > 0` → read `--brief` (or these objects), edit Authored `SKILL.md`, then `dora review --quick <path>`. Do not skip. Do not report done until Review is **exit 0**.
- `--brief` is not a write. Bare `dora fix` as a Runner is **exit 2**.

## `dora skill unused --json`

```jsonc
{
  "load": "project",          // or "global"
  "sessions": 3,
  "last": 30,
  "maxAgeDays": 90,
  "installAgeDays": 90,
  "candidates": [
    { "name": "ghost", "kind": "skill", "removable": true, "recentInstall": false }
  ],
  "recent": []
}
```

`--global` sets `load` to `"global"`. No Sessions: `reason` is `"no-sessions"` and both lists are empty. `kind` is `"skill"` or `"plugin"`. `removable: false` means Review the Plugin root, not `dora skill remove`.

### How to branch (unused)

- `reason === "no-sessions"` → stop. Do not Remove.
- A candidate with `removable: true` → `dora skill remove <name> --dry-run`.
- `kind === "plugin"` or `removable: false` → `dora review --quick <pluginRoot>`.
- Unused writes nothing.

## For hooks

`dora memory context --json` emits the active memory set for injection at session start.
