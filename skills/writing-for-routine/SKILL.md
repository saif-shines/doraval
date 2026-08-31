---
name: writing-for-routine
description: >-
  Use when writing the unattended night prompt for a routine after
  grilling-for-routine, or when the night prompt needs steps and a done-when.
---

# writing-for-routine

Use this craft with an internal teammate. Write the night prompt for a local agent that can loop. This file is the single home for that craft.

## Shape

Write numbered steps. Each step has a done-when. The night agent can tell finished from not finished.

A done-when is a checkable bound. The agent can see it is true or false.

Write in imperative. Do not assign a second-person identity.

Do not use em dashes.

Keep each rule in one home. Do not repeat the same rule in two files.

When extra detail is not needed every run, put it in a later file and point at it. Keep this page short.

The prompt is for an unattended pass. It is not a human chat.

## Steps

1. Read the grill answers. Use the gate. Do not invent a slug, a connector, or a skill.
   Done-when: the gate is in the prompt, and no invented name is present.
2. Write the night prompt as numbered steps. Each step ends with a done-when.
   Done-when: every step has a done-when.
3. Check the prompt: no second-person identity, no em dashes, every step has a done-when.
   Done-when: those three checks pass.
4. Hand the prompt back to `grilling-for-routine` for the one pass.
   Done-when: `grilling-for-routine` has the prompt file.

```
1. Poll the source named in the gate.
   Done-when: new items since the last tick are listed, or the list is empty.
2. Apply the action named in the gate to each new item.
   Done-when: each item is handled or skipped with a reason.
```

MUST write steps and a done-when.
MUST NOT assign a second-person identity.
MUST NOT use em dashes.
