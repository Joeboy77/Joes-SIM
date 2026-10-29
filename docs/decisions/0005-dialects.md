# 0005: Dialects and their edge cases

## Context

The brief asks for Classic, Higginson-compatible and exam-board dialects, with every edge-case
rule written down and sourced. The public sources leave several rules undefined: overflow above
999, what ACC holds after a negative result, when the negative flag clears, and others. The
project owner asked us to make these calls and record them, rather than stop and ask.

## Options

For each undefined rule: copy one popular simulator; pick one rule for all dialects; or pick per
dialect, matching the sources where they exist.

## Choice

Three dialects, defined in `packages/engine/src/dialects/dialects.ts`:

- **Classic**: unsigned 000 to 999, results wrap modulo 1000, a SUB below zero sets the flag and
  any other write to ACC clears it, and BRZ needs the flag clear. Accepts STO and COB.
- **Higginson-compatible**: signed −999 to 999, the flag means ACC < 0, and OTC is available.
  A missing address becomes 00 with a warning.
- **OCR**: Higginson's arithmetic with only the eleven standard mnemonics.

Results beyond the range wrap in every dialect, and the `alu` event marks the wrap, so the
interface can tell the learner. Every rule is in `docs/specs/dialects/`, marked confirmed,
chosen or unconfirmed.

AQA is not a dialect, because its specification does not use the LMC.

## Reason

These choices follow the sources wherever they speak. Where they are silent, we chose the rule
that keeps one program behaving the same way across dialects and that is easiest to show a
learner (a visible wrap rather than a silent clamp or a crash). Rules marked unconfirmed stay
open: if a source turns up, change the dialect file, its spec and the reference expectations
together.
