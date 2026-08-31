---
name: ask-dora
description: >-
  Use when the teammate types /ask-dora, or asks any Dora question or a
  routine idea.
disable-model-invocation: true
---

# ask-dora

User-invoked router for an internal teammate. One name. Use a primitive. Do not hold that primitive's craft here.

## Empty

Print this map. Then stop.

```
Dora jobs: review, fix, unused, scan. Load review-with-dora.
Routine flow: only for a routine, a loop, recurring, or a routine idea.
  Load grilling-for-routine. Night prompt: writing-for-routine.
After a routine exists: dora harness boot, pause, resume, list, open.
```

## Route

1. Read the ask.
2. If it is a routine, a loop, recurring, or a routine idea: load `grilling-for-routine`. Done: that skill is loaded.
3. If it is a Dora job (review, fix, unused, scan): load `review-with-dora`. Done: that skill is loaded.
4. Else: name the matching `dora` verb from `dora --help --json`. Done: the teammate has the next command.

Look up facts (skill on disk, Hermes present). Leave slug, connector, and interval to the human.

MUST print the map when the ask is empty.
MUST load `review-with-dora` for a Dora job.
MUST load `grilling-for-routine` only for a routine, a loop, recurring, or a routine idea.
MUST NOT hold the review loop, the grill, or the night-prompt craft.
