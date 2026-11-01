# 0035: The pipeline and the cache are timing models

## Context

Phase 7 adds a five-stage pipeline and a configurable cache. The brief asks for cycle counts
and cache results that match hand-worked examples, and for both views to build live as a
program runs.

## Decision

The pipeline and the cache are **models over the real run**, not separate machines that compute
results their own way:

- The extended machine runs the program. The pipeline schedules each instruction that ran
  through IF, ID, EX, MEM and WB; the cache replays each memory access.
- So outputs, memory and registers are always exactly those of the other machines, and only
  cycles, stalls, hits and misses are new. This keeps engine correctness, the brief's first
  rule, independent of the new views.
- Both views follow the trace, so they work after stepping, an instant run or a jump on the
  timeline, like the trace table.

Choices in the models, each explained in its spec:

- The pipeline is an accumulator pipeline: ADD and SUB add in MEM, once the operand arrives, so
  instructions that use ACC in MEM need no stall with forwarding, while BRZ and BRP (which
  decide in EX) wait one cycle after a load.
- Prediction is a 2-bit counter with a branch target buffer. RET, RTI and interrupt entry are
  never predicted.
- Cache addresses are split in binary (7 bits), with power-of-two sizes, as in textbooks.
  Write-back allocates on a write miss; write-through does not.

## Consequences

The specs ([pipeline](../specs/pipeline.md), [cache](../specs/cache.md)) hold the hand-worked
examples, and the tests check them line by line. A store that changes an instruction already
fetched is modelled as a refetch, since a real pipeline must detect it.
