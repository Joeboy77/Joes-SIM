# 0038: Custom machines and the RISC-V bridge

## Context

Phase 10 lets teachers design their own machines without writing code, and adds a small
RISC-V (RV32I) machine whose results match RARS. The formats are in
[custom-machines.md](../specs/custom-machines.md) and [riscv.md](../specs/riscv.md).

## Decision

**Custom machines.**

- A machine is one JSON file: memory, word (digits, base, signed), registers with four required
  roles (PC, MAR, MDR, IR), a fetch sequence and instructions, each a list of micro-operations
  from a fixed set (copy, set, read, write, inc, dec, alu, input, output, jump, halt).
- A fixed set of micro-operations, rather than a scripting language, is what makes "without
  writing code" true: the designer builds every instruction from dropdowns, and every problem
  is explained in plain language before the machine can run.
- Instructions can share an opcode with a fixed operand (`fixedOperand`), so LMC's INP (901) and
  OUT (902) can be expressed. The classic LMC is itself a definition, and every classic reference
  program gives the same results on it as on the built-in machine (a test).
- The datapath view is generated from the definition: a box per register plus memory, ALU,
  input and output, and a bus for every pair a micro-operation connects.
- Machines are shared as `.json` files or as `/machines?m=…` links (compressed like share links).

**RISC-V.**

- The assembler produces real RV32I words, with RARS's memory layout, pseudo-instruction
  expansions and `ecall` services, so the listing shows the same machine code as RARS.
- It is a separate page (`/riscv`) and a lesson component, not a mode of the LMC simulator: its
  state (32 registers, byte memory) and its views (register file, single-cycle datapath) are
  different enough that sharing the LMC store would have made both worse.
- Stepping back replays from the start, which is exact because the machine is deterministic.

## Agreement with RARS

The 19 test programs' expected output was worked out from the RV32I specification and RARS's
documented behaviour. RARS itself could not be run in the build environment (downloading and
running it was not permitted there), so `scripts/check-rars.sh` runs the same programs through
a RARS jar you supply and compares the output.
