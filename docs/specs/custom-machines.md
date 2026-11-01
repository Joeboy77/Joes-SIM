# Custom machines

Teachers can define their own machines without writing code (brief, Phase 10). A definition is
one JSON file describing:

- the memory, the word and the registers;
- each instruction, as a list of **micro-operations**.

The designer screen at `/machines` edits a definition with forms, tests it on a program, and
shares it as a file or a link. The code is in `packages/engine/src/machines/custom/`.

## The format

```json
{
  "format": "joes-sim-machine",
  "version": 1,
  "name": "LMC with INC and MUL",
  "description": "The Little Man Computer, plus two instructions.",
  "memory": 100,
  "word": { "digits": 3, "base": 10, "signed": false },
  "opcodeDigits": 1,
  "registers": [
    { "name": "PC", "role": "pc" },
    { "name": "MAR", "role": "mar" },
    { "name": "MDR", "role": "mdr" },
    { "name": "IR", "role": "ir" },
    { "name": "ACC" }
  ],
  "fetch": [
    { "op": "copy", "from": "PC", "to": "MAR" },
    { "op": "read" },
    { "op": "copy", "from": "MDR", "to": "IR" },
    { "op": "inc", "reg": "PC" }
  ],
  "instructions": [
    {
      "mnemonic": "LDA",
      "opcode": 5,
      "operand": true,
      "description": "Load a mailbox into ACC",
      "micro": [
        { "op": "copy", "from": "operand", "to": "MAR" },
        { "op": "read" },
        { "op": "copy", "from": "MDR", "to": "ACC" }
      ]
    }
  ]
}
```

| Field          | Meaning                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `memory`       | How many memory words, 10 to 1000                                                                                                                 |
| `word`         | `digits`: 1 to 6. `base`: 10, 2 or 16. `signed`: whether values can be negative                                                                   |
| `opcodeDigits` | Leading digits of an instruction word that hold the opcode. The rest hold the operand (usually an address)                                        |
| `registers`    | Names (letters, digits, underscore). Four need a `role`: `pc`, `mar`, `mdr` and `ir`. Others are free (ACC, B, X…)                                |
| `fetch`        | The micro-operations that fetch an instruction. Decoding is automatic: the IR splits into opcode and operand                                      |
| `instructions` | `mnemonic` (2 to 6 letters), `opcode` (a number that fits the opcode digits), `operand` (whether it takes an address), `description`, and `micro` |

**Instruction words.** An instruction word is `opcode × base^(digits − opcodeDigits) + operand`.

**Word values.**

- Unsigned: 0 to base^digits − 1.
- Signed: −(base^digits − 1) to base^digits − 1. A signed word keeps a sign, as in the
  Higginson LMC.
- Results that do not fit **wrap** to the range.

**Memory size.** It must not need more operand digits than the instruction has.

## Micro-operations

| `op`     | Fields                                  | What it does                                                                                 |
| -------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| `copy`   | `from`, `to`                            | Copy a register, or `operand` (the IR's operand field), into a register                      |
| `set`    | `reg`, `value`                          | Put a constant in a register                                                                 |
| `read`   |                                         | MDR ← memory[MAR]                                                                            |
| `write`  |                                         | memory[MAR] ← MDR                                                                            |
| `inc`    | `reg`                                   | Add 1. For the `pc` role it wraps round memory; for others round the word                    |
| `dec`    | `reg`                                   | Take 1 away                                                                                  |
| `alu`    | `fn`, `a`, `b` (not for `negate`), `to` | `to` ← a `fn` b, for `fn` one of `add`, `sub`, `mul`, `div`, `mod`, `negate`. Sets the flags |
| `input`  | `to`                                    | Take the next input                                                                          |
| `output` | `from`, `as` (`number` or `char`)       | Put a value in the output                                                                    |
| `jump`   | `when`, `to` (register or `operand`)    | Set the PC if the condition holds                                                            |
| `halt`   |                                         | Stop                                                                                         |

**Flags.**

- **Z**: the last ALU result was 0.
- **N**: the last ALU result's true value was below zero. On an unsigned machine this also
  holds when the result wrapped below zero, as LMC's negative flag does.
- Copying into a register with `copy` sets Z and N from the value copied, as LDA does.

**`when`** is one of:

| `when`         | The jump happens… |
| -------------- | ----------------- |
| `always`       | always            |
| `zero`         | if Z is set       |
| `not-zero`     | if Z is clear     |
| `negative`     | if N is set       |
| `not-negative` | if N is clear     |

Division and remainder by 0 give 0.

## Programs

Each line of a program has the form `[label] MNEMONIC [operand]`. Comments start with `//`, `;`
or `#`. `DAT [value]` fills a word.

Labels and mnemonics follow the same rules as the LMC assembler, with the machine's own
mnemonics.

## Running and the views

The machine runs one micro-operation at a time:

1. the fetch steps;
2. decode;
3. the instruction's steps.

Each step reports what it moved, in the same form as the built-in machines' events. So:

- the generated **datapath view** can animate each transfer;
- the **narration** can describe each step in plain words, from the micro-operation.

The datapath draws:

- a box for every register, plus memory, the ALU, input and output;
- a bus for every pair of parts that any micro-operation connects.

## Checking a definition

Before a definition can be used, every problem is listed in plain language, for example:

- "Instruction INC: register 'AC' does not exist. The registers are PC, MAR, MDR, IR, ACC."
- "Opcodes 1 and 1 are both used (ADD and INC)."
- "With 1 opcode digit there can be at most 10 opcodes."

## Sharing

A definition is shared in either of two ways:

- as a `.json` file;
- as a link `/machines?m=…` that holds the definition, compressed like share links.

The **"LMC"** preset is a definition of the classic machine. Every classic reference program
gives the same outputs on it as on the built-in machine (a test).
