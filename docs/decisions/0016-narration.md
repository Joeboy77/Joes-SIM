# 0016: Narration

## Context

The brief asks for a short sentence for each micro-step and instruction, at beginner and
technical levels, translatable and announced to screen readers.

## Choice

- `@joes-sim/narration` turns micro-step events and the state after them into sentences. It
  never looks inside the engine.
- One micro-step gets its own sentence. A whole instruction gets one summary, such as "The
  instruction is 512, so the Little Man loads the value from mailbox 12 into the accumulator.
  The accumulator is now 42." Anything else (the end of an instruction started earlier) gets a
  sentence per micro-step.
- Messages live in a catalogue (`src/en.ts`). `{name}` is a value and `[[PC]]` names a machine
  part. To translate, copy the catalogue and keep the keys. Catalogue keys are typed, so a
  missing message fails the build.
- Sentences come back as segments. A segment for a machine part carries its component, so the
  app underlines it, highlights it while that part is active, and highlights the part in the
  datapath when the learner points at the word.
- Values are plain numbers ("42"); instruction words and addresses keep their LMC form ("512",
  "mailbox 05").
- The sentence is announced through a polite live region only when paused or at slow speeds,
  so screen readers are not flooded while the machine runs.

## Tests

Every instruction in every dialect is narrated at both levels, including each branch outcome,
wrapping, the negative flag and invalid instructions. A test proves every message in the
catalogue can be produced.
