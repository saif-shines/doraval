---
name: grilling-for-routine
description: >-
  Use when ask-dora routes a routine idea, when running dora harness new,
  or when grilling a loop-able idea into a routine. Collect skills to run,
  skills to refer to, and the Scalekit Agent Gateway MCP URL.
---

# grilling-for-routine

Use this grill with an internal teammate. Turn a routine idea into a routine.
Hermes is the agent. Do not pick a sample product.

## Loop-able

First check: can the same prompt run on an interval?

Loop-able: a poll, a scan, or a check that can repeat with no human on each tick.

Not loop-able: a webhook, a push listener, a one-off, or a job that needs a human every tick.

If not loop-able: say why. Do not write a routine folder. If it is a Dora job, load review-with-dora. Stop.

## Connectors

Load `discover-connectors` (Scalekit). Look up the live catalog. Say what exists. Say if a needed connector is missing. Do not vendor that catalog here.

An interval job cannot do a push, a webhook, or a human in the loop every tick. Say so when the idea needs one of those.

## Gate

Collect all three before you write the unattended prompt:

1. Skills to **run** (optional extra SKILL.md folders the night pass loads).
   Say **none** if the MCP tools are enough.
2. Skills to **refer to** (optional folders the prompt may cite).
   Say **none** if none.
3. Scalekit Agent Gateway **MCP URL** (required).
   Slack, GitHub, and other connectors live here. A connector is not a skill.

A default shared MCP URL may already be saved. Reuse it. Ask before you override it for this routine.

If no matching skill is on disk, do not invent one. Offer **none**, a local path, or a GitHub URL. Do not treat a missing Slack or GitHub skill as a blocker.

## Routine copy

A skill source is a name, a local path, or a GitHub URL.

Name lookup: project `skills/`, then home skills, then ask for a path or a GitHub URL. Do not invent a registry.

Dora copies each skill folder into the routine. Night-pass edits land on the copy. Do not write the original.

Offer `dora review --quick` on each copy. The teammate can skip.

## Order

1. Run the loop-able check.
2. Ask what the routine idea does until the night prompt is specific.
3. Collect the gate. Offer a readable slug. The teammate picks or renames it.
4. Run the connector check.
5. Load `writing-for-routine`. Write the night prompt.
6. Print the one-pass command. If Hermes is present, offer to run it. If Hermes is missing, print official install steps. Do not fake a pass.
7. Write the routine folder only after that pass, or after the teammate accepts the printed command. Save copies the skills into the routine. Then offer `dora review --quick` on each copy. The teammate can skip.
8. After `dora harness boot`, tell the teammate to run `hermes mcp login scalekit`. Dora does not run that login. If a refresh token dies, run that command again. If the Scalekit connected account is dead, open the provider link again.

Do not ask for the loop interval during this grill. Default is 1 hour. Ask after a good run.

```bash
dora harness new --accept --yes --slug <slug> --prompt-file <prompt.md> --mcp-url <url> --skills-run <name|path|url> --skills-refer <name|path|url>
```

MUST run the loop-able check first.
MUST collect the gate before save.
MUST accept none for skills to run and skills to refer.
MUST copy named skills into the routine.
MUST NOT require a skill because a connector exists.
MUST NOT write the original skill directory.
MUST NOT invent a registry, a slug, a connector, or a loop interval.
MUST NOT write the folder when the idea is not loop-able.
MUST NOT write the folder before the one pass or an accepted printed command.
