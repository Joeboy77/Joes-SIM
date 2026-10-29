# 0006: Micro-steps, stages and what a "cycle" is

## Context

Learners step by whole instruction or by micro-step, and challenges score "cycles" (brief, 8.1:
"add two numbers" targets 6 instructions and 6 cycles).

## Options

- Count cycles as micro-steps (clock ticks).
- Count cycles as fetch, decode, execute cycles, one per instruction executed.

## Choice

- `cycles` = instructions completed. `microSteps` = micro-steps completed.
- Each instruction is 4 fetch micro-steps, 1 decode, then 1 execute step (branches, I/O, HLT)
  or 3 (ADD, SUB, LDA, STA). `state.stage` records the position (0 = between instructions), so
  any state can be resumed, including part-way through an instruction.
- INP with an empty input tray waits at its execute step with status `waiting-input`.
- An invalid instruction stops at decode with status `error`.

## Reason

The brief's own example only works if cycles count instructions. Keeping micro-steps as a
separate counter gives Phase 7 (pipelines, CPI) a clock-level figure without changing what
challenges mean.
