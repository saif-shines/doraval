# Add `dora agent-help` as the agent command map

**Status:** superseded by ADR 0009.

Agents need a live map of verbs, flags, and examples. We add `dora agent-help` (Entire’s shape): bare = text catalog, `--json` = same tree, `agent-help <cmd>` = one verb. Each verb is **read-only** or **writes** (same split as the write gate). `--help` stays the short first-loop page, not a third catalog. `--capabilities` is removed (ADR 0005).
