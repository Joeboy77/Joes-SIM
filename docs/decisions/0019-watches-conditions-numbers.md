# 0019: Watches, run-until conditions and number views

## Choice

- **Watches** show the accumulator, program counter, any mailbox or the number of outputs, with
  what each was before the last instruction.
- **Run until** conditions compare one of the same targets with a number (=, ≠, <, ≤, >, ≥).
  They are plain data, checked after every instruction by the engine's `run()` (so instant runs
  in the worker honour them) and by animated playback. The run stops after the first
  instruction that makes any condition true, and the status line says which.
- **Number views** show a value in decimal, binary, hexadecimal and two's complement. Classic
  values (0 to 999) need 10 bits; signed dialects (-999 to 999) need 11. Binary and hex show a
  minus sign for negative values; two's complement shows the stored bit pattern. Views appear in
  the Watch table and in a card when the learner points at, focuses or long-presses a mailbox.
