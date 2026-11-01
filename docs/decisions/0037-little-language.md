# 0037: The Little Language compiler

## Context

Phase 9 adds a small high-level language that compiles to LMC, so learners see how statements
they know become machine instructions. Its grammar is in
[docs/specs/little-language.md](../specs/little-language.md).

## Decision

- **Line-based syntax with keywords**: `if … then … else … end` and `while … do … end`, one
  statement per line. It reads like the pseudocode used in exams and needs no braces or
  indentation rules, and each source line maps cleanly to a block of instructions.
- **Only what LMC can do directly is built in**: `+` and `-` use ADD and SUB. `*`, `/` and `%`
  are built from loops, written out at each use on the Classic target and shared as a subroutine
  (CALL) on the Extended target, so the two targets differ in a way worth seeing.
- **Readable output**: each statement's code is introduced by a comment repeating it, labels say
  what they are for (`while1`, `endwhile1`), and variables keep their names.
- **The mapping goes through the assembler**: each generated line records its source line, and
  the assembler's own source map turns that into mailboxes, so every instruction (and every
  mailbox) maps back to a source line. The tests check this for every test program.
- **The optimiser is small and visible**: constant folding, dropping a reload after a store, and
  dropping a jump to the next line. The page shows instruction counts with and without it.
- **The page is separate from the simulator** (`/compiler`), with its own run controls, since the
  simulator's editor holds LMC. A link opens the generated LMC in the full simulator.

## Consequences

Comparisons work out `left − right`, so in a signed dialect they can be wrong when the difference
does not fit in −999 to 999; the spec says so. `*`, `/` and `%` expect operands of 0 or more.
