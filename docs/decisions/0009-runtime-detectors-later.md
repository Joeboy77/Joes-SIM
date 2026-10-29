# 0009: Which mistake detectors are static

## Context

Phase 1 asks for the mistake detectors from Section 7.6 "that do not need a run".

## Choice

Static detectors in Phase 1 (`packages/engine/src/analysis/detectors.ts`): no HLT, running into
a DAT, running past the end into empty mailboxes, reading a mailbox that is never given a value,
unreachable code, a part of the program that can never stop, and input counts when the program
has no loops. The assembler covers misspelt, undefined, duplicate and misused labels, and
addresses or values out of range.

These detectors move to Phase 3, where they can watch a run:

- **Expecting BRP to skip on zero.** Only the learner's intent makes this a mistake, so it needs
  runtime context (for example, a BRP taken with ACC = 0 just after a SUB).
- **Asking for more inputs than were given, when a loop decides how many.**
- **Executing a mailbox that was written as data**, when a STA writes it during the run.

Detectors stay quiet on self-modifying code. The analysis skips mailboxes that a reachable STA
writes, and it skips the "cannot stop" check when the program modifies itself. Self-modifying
code is how classic LMC handles arrays, so it is a skill to learn, not a mistake.

## Reason

A static check that cries wolf teaches learners to ignore hints. We keep a static check only
where it can be right without knowing what the learner intended.
