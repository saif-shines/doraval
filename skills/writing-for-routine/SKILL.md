---
name: writing-for-routine
description: >-
  Use when writing the unattended night prompt for a routine after
  grilling-for-routine, when freezing a deterministic step into a
  Fixed-step Skill, or when the night prompt needs steps and a done-when.
---

# writing-for-routine

Use this craft with an internal teammate. Write `prompt.md` and, when the grill freezes a step, the Fixed-step Skill. This file is the single home for that craft.

## Shape

Write numbered steps. Each step has a done-when. The night agent can tell finished from not finished.

A done-when is a checkable bound. The agent can see it is true or false.

Write in imperative. Do not assign a second-person identity.

Do not use em dashes.

Keep each rule in one home. Do not repeat the same rule in two files.

Do not name a prompt step Judgment. Judgment is a Dora Finding.

When extra detail is not needed every run, put it in a later file and point at it. Keep this page short.

The prompt is for an unattended pass. It is not a human chat.

## prompt.md

Keep the steps that need a new decision. Name the Fixed-step Skill. Do not repeat the frozen steps.

## Fixed-step Skill

Same craft: steps and a done-when. No second-person identity. No em dashes.

A Skill script is optional. If one exists, it lives inside that Skill. Name the helper file in `SKILL.md`. Local work only. The routine has no top-level scripts directory. Do not use Hermes `--script` or `--no-agent`.

## Steps

1. Read the grill answers. Use the gate. Do not invent a slug, a connector, or a skill.
   Done-when: the gate is in the prompt, and no invented name is present.
2. Write `prompt.md` as numbered decision steps. Name any Fixed-step Skill. Do not repeat frozen steps.
   Done-when: every step has a done-when, and frozen steps are not copied here.
3. If the grill froze a step, write that Skill in the temp folder. Optional Skill script inside the Skill.
   Done-when: the Skill has steps, a done-when, and names any helper file.
4. Check both files: no second-person identity, no em dashes, every step has a done-when, no Judgment as a step name.
   Done-when: those checks pass.
5. Hand both files back to `grilling-for-routine` for the one pass.
   Done-when: `grilling-for-routine` has the prompt file and any Skill draft.

```
1. Poll the source named in the gate.
   Done-when: new items since the last tick are listed, or the list is empty.
2. Apply the action named in the gate to each new item.
   Done-when: each item is handled or skipped with a reason.
```

MUST write steps and a done-when.
MUST write `prompt.md` and the Fixed-step Skill when a step is frozen.
MUST NOT put a Skill script next to `prompt.md`.
MUST NOT add a top-level scripts directory.
MUST NOT use Hermes `--script` or `--no-agent`.
MUST NOT assign a second-person identity.
MUST NOT use em dashes.
MUST NOT name a prompt step Judgment.
