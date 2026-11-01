# The RISC-V bridge

A small RISC-V machine (part of RV32I), so learners can carry what they know from LMC to a real
instruction set, and on to tools such as RARS (brief, Phase 10). The code is in
`packages/engine/src/machines/riscv/`.

## What it has

**Registers.**

- 32 registers, x0 to x31, each 32 bits. x0 is always 0.
- They are shown with their ABI names: zero, ra, sp, gp, tp, t0–t6, s0–s11 and a0–a7.
- There is also the PC.

**Memory.** Byte-addressed and little-endian, laid out as in RARS:

| Item          | Address      |
| ------------- | ------------ |
| `.text`       | `0x00400000` |
| `.data`       | `0x10010000` |
| `gp` at start | `0x10008000` |
| `sp` at start | `0x7fffeffc` |

**Instructions** (real 32-bit encodings, so the machine-code view shows the same words as RARS):

| Group                | Instructions                                 |
| -------------------- | -------------------------------------------- |
| Arithmetic and logic | add sub and or xor sll srl sra slt sltu      |
| With an immediate    | addi andi ori xori slti sltiu slli srli srai |
| Upper immediates     | lui auipc                                    |
| Loads and stores     | lw lh lhu lb lbu sw sh sb                    |
| Branches             | beq bne blt bge bltu bgeu                    |
| Jumps                | jal jalr                                     |
| System               | ecall                                        |

**Pseudo-instructions**, expanded as RARS does:

- `li` (`addi`, or `lui` + `addi` for large values)
- `la` (`auipc` + `addi`)
- `mv`, `not`, `neg`
- `j`, `jr`, `ret`, `call` (`jal ra`), `nop`
- `beqz`, `bnez`, `bltz`, `bgez`, `bgtz`, `blez`
- `bgt`, `ble`, `bgtu`, `bleu`

**Directives:**

- `.text` and `.data`;
- `.word`, `.half`, `.byte`, `.space`, `.ascii`, `.asciz` and `.string`;
- `.globl` and `.align`, which are accepted.

**System calls** (`ecall` with the service number in `a7`), as numbered in RARS:

| a7  | Service                                     |
| --- | ------------------------------------------- |
| 1   | Print `a0` as a signed integer              |
| 4   | Print the zero-ended string at address `a0` |
| 5   | Read an integer into `a0`                   |
| 10  | Exit                                        |
| 11  | Print `a0` as a character                   |
| 93  | Exit with the code in `a0`                  |

Running off the end of the program stops it, as RARS does when it "drops off the bottom".

## Steps, the datapath and narration

Each instruction is shown in five stages:

1. **Fetch** the word at the PC.
2. **Decode** it, reading rs1 and rs2 and building the immediate.
3. **Execute** in the ALU, or compare for a branch.
4. **Memory**, for loads and stores.
5. **Write back** to rd, and update the PC.

The datapath view lights each part as it is used:

- the PC;
- instruction memory;
- the register file;
- the immediate generator;
- the ALU;
- data memory;
- the PC adder and the branch target.

Narration explains each instruction in a beginner and a technical sentence, for example:

> addi t0, zero, 5: t0 = 0 + 5 = 5.

Stepping back replays from the start (the machine is deterministic). There is a keyframe every
1,000 instructions.

## Agreement with RARS

The test programs in `riscv.test.ts` print with `ecall`. Their expected output, and the expected
encodings of every instruction, follow the RV32I specification and RARS's documented behaviour.

The script `scripts/check-rars.sh` runs the same programs through a RARS jar and compares the
output. The jar is not stored in this repository, so you supply your own copy.
