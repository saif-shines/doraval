---
name: grill-routine
description: >-
  Use when running dora harness new, grilling a use case into a routine,
  or collecting skills to run, skills to refer to, and an MCP URL for an
  unattended night pass.
---

# Grill a routine

Use this grill with an internal teammate. Turn a use case into a routine. Hermes is the agent. Do not pick a sample product.

## Gate

Collect all three before you write the unattended prompt:

1. Skills to **run** (directories the night pass loads)
2. Skills to **refer to** (directories the prompt may cite)
3. Scalekit Agent Gateway **MCP URL**

A default shared MCP URL may already be saved. Reuse it. Ask before you override it for this routine.

## Order

1. Ask what the use case does until the night prompt is specific.
2. Collect the gate. Pick a readable slug. Offer a rename.
3. Keep answers in the prompt file. Load writing-for-agents and write the unattended prompt for an agent. Imperative. No second-person identity. No em dashes.
4. Print the one-pass command. If Hermes is present, offer to run it. If Hermes is missing, print official install steps. Do not fake a pass.
5. Write the routine folder only after that pass, or after the teammate accepts the printed command.
6. After `dora harness boot`, tell the teammate to run `hermes mcp login scalekit`. Dora does not run that login. If a refresh token dies, run that command again. If the Scalekit connected account is dead, open the provider link again.

```bash
dora harness new --accept --yes --slug <slug> --prompt-file <prompt.md> --mcp-url <url> --skills-run <dir> --skills-refer <dir>
```

MUST collect the gate before save. MUST NOT write the folder before the one pass or an accepted printed command.
