# The assembler

## Syntax

Each line is:

```
[label] MNEMONIC [operand] [comment]
```

- Mnemonics are case-insensitive (`lda`, `LDA`, `Lda`).
- Labels are case-sensitive (`Loop` and `loop` are different). A label starts with a letter or
  underscore and contains letters, digits and underscores. A trailing colon (`loop:`) is allowed.
- Operands are a mailbox number (00 to 99), a label, or for DAT a value in the dialect's range.
- Comments start with `//`, `;` or `#` and run to the end of the line.
- Blank lines are allowed and take no mailbox.
- Each instruction or DAT takes the next mailbox, starting at 00.

Source: Higginson's help page states the case rules ("The assembler accepts both lower and upper
case"; "Loop and loop are different labels") and `//` comments. `;` and `#` comments and the
trailing colon are Joe's SIM additions, accepted in every dialect because they are common in
textbooks.

## Two passes

1. Read each line, give it an address, record labels.
2. Resolve label operands and fill the mailboxes.

The result includes the 100 mailbox values, the label table, a source map both ways (line to
address and address to line), and each mailbox's kind (`code`, `data` or `empty`).

## Diagnostics

Each diagnostic has a line, start and end column, a short message, a plain-language
explanation and, where possible, a fix (an edit that can be applied with one click).

| Code                         | Severity                   | Example                                                   |
| ---------------------------- | -------------------------- | --------------------------------------------------------- |
| `unknown-instruction`        | error                      | "Unknown instruction 'LDR'. Did you mean LDA?"            |
| `instruction-not-in-dialect` | error                      | "OTC is not available in the Classic dialect."            |
| `label-without-instruction`  | error                      | "'loop' is not an instruction." (a label alone on a line) |
| `invalid-label`              | error                      | "'1abc' cannot be used as a label."                       |
| `duplicate-label`            | error                      | "The label 'x' is already used on line 1."                |
| `undefined-label`            | error                      | "Label 'lop' is not defined. Did you mean 'loop'?"        |
| `missing-address`            | error or warning (dialect) | "ADD needs an address."                                   |
| `address-out-of-range`       | error                      | "There is no mailbox 100."                                |
| `value-out-of-range`         | error                      | "1000 does not fit in a mailbox."                         |
| `invalid-operand`            | error                      | "'12x' is not a number or a label."                       |
| `operand-ignored`            | warning                    | "INP does not use an address, so '5' is ignored."         |
| `extra-text`                 | warning                    | "Text after the operand is ignored." (suggests `//`)      |
| `program-too-long`           | error                      | "The program does not fit in 100 mailboxes."              |

Suggestions use edit distance with letter swaps counted as one edit. Words of one or two
letters only get case-only suggestions, because almost every short word is one edit from another.

Higginson's assembler gives an error when an address is left out and a comment follows. Joe's SIM
does not reproduce that quirk: comments never change how a line is read.

## Disassembler

`disassemble(memory)` turns mailbox values back into assembly. A value becomes a mnemonic only
when that mnemonic assembles back to exactly the same value; otherwise it is written as DAT
(for example 007 decodes as HLT, but HLT assembles to 000, so 007 is shown as `DAT 7`).
Assembling the disassembly always gives back the same memory, and a property test checks this.
