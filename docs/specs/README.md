# Specifications

Instruction set and dialect specifications. Every rule names its source; rules that cannot be
confirmed from a public source are marked **unconfirmed** and reviewed before learners rely on them.

| File                                           | What it covers                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| [classic.md](classic.md)                       | The machine: registers, instruction set, micro-steps, events, run loop |
| [assembler.md](assembler.md)                   | Syntax, the two passes, diagnostics, the disassembler                  |
| [dialects/classic.md](dialects/classic.md)     | Classic dialect rules                                                  |
| [dialects/higginson.md](dialects/higginson.md) | Higginson-compatible dialect rules                                     |
| [dialects/ocr.md](dialects/ocr.md)             | OCR (GCSE and A level) dialect rules                                   |

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

Planned: `extended.md` (Phase 6, reviewed before building), `little-language.md` (Phase 9).
