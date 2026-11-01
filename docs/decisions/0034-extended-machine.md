# 0034: The extended machine

## Context

Phase 6 adds a stack, subroutines, indirect and indexed addressing, interrupts and virtual
devices. The brief requires classic programs to run unchanged, and allows a wider word or more
memory if the design explains the choice.

## Decision

The full design is in [docs/specs/extended.md](../specs/extended.md). In short:

- The word stays 3 digits and memory stays 100 mailboxes. Arithmetic, wrapping, the instruction
  encoding and the 10 × 10 memory grid are all exactly as in the classic machine.
- New instructions use the opcode 4, which classic LMC never uses. The middle digit names the
  family (41x stack, 42x indirect, 43x indexed, 44x interrupts, 45x devices). Instructions that
  need an address take a second mailbox. 400 to 409 stay invalid, so the reference program that
  runs `DAT 400` still stops with an error.
- Devices are reached through ports (GET and PUT), not mailboxes, because a 256-pixel display
  cannot fit in 100 mailboxes.
- The timer counts instructions, and key presses are recorded against the cycle they arrive
  in, so every run can be replayed exactly.
- The extended machine is the classic machine plus an `ext` part of the state. When `ext` is
  absent, nothing changes: the same code runs classic programs, which is how requirement 1 is
  kept and tested.

## Reviewed

The draft was reviewed on 1 November 2026 and approved with the draft's answer to each open
question.

## Changes made while building

The specification records each one where it applies.

- **The keyboard interrupt stays pending while keys wait in the buffer.** The draft raised it
  once per key, so a handler that read one key lost the next if two were typed quickly.
- **No loop is called infinite while interrupts are on.** A timer-driven program can repeat its
  whole state exactly (a dot wrapping round the display), yet a key could change it at any
  moment. Playback would otherwise have stopped such programs as stuck.
- **WAIT idles by running again** while the timer counts, so idle time shows up as cycles and the
  timer keeps ticking.
- **One set of semantics.** The fast run loop runs extended instructions and interrupt entry
  through the micro-step machine, so the two cannot disagree; only WAIT's idling has its own
  fast path, checked by the same property tests. A million timer-driven instructions run in
  about 1.5 seconds.
- **Static checks are simpler than drafted.** "PUSH with no POP" replaced "PUSH and POP balance on
  every path", which flagged correct recursive programs.
