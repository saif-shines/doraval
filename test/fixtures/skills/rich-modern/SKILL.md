---
name: rich-modern
description: "Use when you need a full-spec example with rich frontmatter, dynamic injection and substitutions."
when_to_use: "user asks to visualize the repo, generate a map, or explore structure with a script"
disable-model-invocation: false
user-invocable: true
allowed-tools: Read Grep Bash(node *)
context: fork
agent: Explore
arguments: [target]
shell: bash
paths: "**/*.ts, **/*.js"
---

# Rich Modern Skill

Target: $ARGUMENTS or $0

Current tree:
!`find ${target:-.} -type f -maxdepth 2 | head -20`

See [reference.md](reference.md) and the helper in `scripts/`.

1. Read the reference material.
2. Run the helper script using ${CLAUDE_SKILL_DIR}.
3. Produce a report.
