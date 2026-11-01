# Specifications

Instruction set and dialect specifications. Every rule names its source; rules that cannot be
confirmed from a public source are marked **unconfirmed** and reviewed before learners rely on them.

| File                                           | What it covers                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| [classic.md](classic.md)                       | The machine: registers, instruction set, micro-steps, events, run loop                 |
| [assembler.md](assembler.md)                   | Syntax, the two passes, diagnostics, the disassembler                                  |
| [dialects/classic.md](dialects/classic.md)     | Classic dialect rules                                                                  |
| [dialects/higginson.md](dialects/higginson.md) | Higginson-compatible dialect rules                                                     |
| [dialects/ocr.md](dialects/ocr.md)             | OCR (GCSE and A level) dialect rules                                                   |
| [pipeline.md](pipeline.md)                     | The five-stage pipeline: stages, hazards, forwarding, prediction, hand-worked examples |
| [cache.md](cache.md)                           | The cache: configuration, address split, policies, hand-worked examples                |
| [custom-machines.md](custom-machines.md)       | The machine definition format: memory, word, registers, micro-operations               |
| [riscv.md](riscv.md)                           | The RISC-V (RV32I) subset: instructions, memory, system calls, stages                  |
| [little-language.md](little-language.md)       | The Little Language: grammar, meaning, how it compiles, mapping                        |
| [community-api.md](community-api.md)           | The optional community API: leaderboards, gallery, short links                         |
| [multicore.md](multicore.md)                   | The multicore machine: cores, scheduling, TAS, race detection                          |
| [extended.md](extended.md)                     | The extended machine (Phase 6): stack, addressing modes, interrupts, devices. Approved |

## Dialect differences at a glance

| Rule            | Classic                       | Higginson-compatible | OCR         |
| --------------- | ----------------------------- | -------------------- | ----------- |
| Values          | 000 to 999                    | -999 to 999          | -999 to 999 |
| 4 − 9           | 995, flag set                 | −5                   | −5          |
| 999 + 1         | 000 (wrapped)                 | 0 (wrapped)          | 0 (wrapped) |
| BRZ             | ACC = 0 and flag clear        | ACC = 0              | ACC = 0     |
| BRP             | flag clear (zero is positive) | ACC ≥ 0              | ACC ≥ 0     |
| STO             | yes                           | yes                  | no          |
| COB             | yes                           | no                   | no          |
| OTC             | no                            | yes                  | no          |
| Missing address | error                         | 00 with a warning    | error       |

The reference programs in `packages/engine/src/reference/programs.ts` run in every dialect,
and their expected results document every difference.
