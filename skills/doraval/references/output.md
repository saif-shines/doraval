# dora — exit codes & JSON output

## Exit codes (global contract)
| Code | Meaning | Agent action |
| --- | --- | --- |
| `0` | clean — no issues | proceed / report done |
| `1` | issues found | fix, or surface to user; do NOT report done |
| `2` | could not run (internal error / unmet prerequisite) | report the failure and why; never claim a pass |

`--deep` reviews exit `2` when no LLM judge is available — that's "could not
run the tier you required," not "clean."

## `dora --format json` — scan shape
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

## How to branch
- `.summary.failed > 0` → there are hard failures. Fix before done.
- `.contradictions[].severity === "conflict"` → cross-agent conflict; run
  `dora reconcile`.
- `.health[].status` is `"pass" | "warn" | "fail"` per artifact.
- `.intelligence.judge` is `"api" | "delegate"`. `"api"` means dora can call the
  configured judge directly. `"delegate"` means the calling agent should evaluate
  the emitted `JUDGE THIS` block inline; `--ci` still requires API credentials.
  A clean `--quick` result is structural only.

## For hooks
`dora memory context --json` emits the active memory set for injection into an
agent's context at session start.
