# OCR dialect (GCSE and A level)

The LMC instruction set used in OCR's GCSE (J277) and A level (H446) Computer Science
specifications and exam papers. Dialect id: `ocr`.

Status key as in [classic.md](classic.md).

| #   | Rule                               | Value                                                                            | Status      | Source or reason                                                                                                                        |
| --- | ---------------------------------- | -------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | Mnemonics                          | ADD SUB STA LDA BRA BRZ BRP INP OUT HLT DAT only                                 | unconfirmed | This is the set used in OCR exam papers and revision guides. We have not yet checked it against the specification documents themselves. |
| O2  | STO, COB, OTC                      | not accepted; the error names the OCR spelling or suggests the Higginson dialect | chosen      | Follows from O1. Keeps learners to what exam answers use                                                                                |
| O3  | Arithmetic, ranges, flag, BRZ, BRP | same as Higginson-compatible (H1 to H7)                                          | unconfirmed | OCR does not define edge cases. Schools teaching OCR mostly use Higginson's simulator, so answers match what learners see there         |
| O4  | Invalid instructions, 0xx, PC wrap | same as Higginson-compatible (H11 to H14)                                        | unconfirmed | As O3                                                                                                                                   |
| O5  | Instruction with no address        | assembly error                                                                   | chosen      | Exam answers always give an address; an error helps learners write answers that earn marks                                              |
| O6  | Labels                             | case-sensitive                                                                   | chosen      | As Higginson                                                                                                                            |

AQA does not use the LMC: its specification uses its own assembly language, so it is not a
dialect here. It is a candidate for the custom-machine feature in Phase 10.

To confirm O1, check OCR's published J277 and H446 specifications.
