# The Little Language

A small high-level language that compiles to Little Man Computer assembly (brief, Phase 9). It is
there to show how statements learners know from programming courses become machine
instructions. The compiler is in `packages/compiler`.

## A first program

```
# Count down from a number to 1
input n
while n > 0 do
  print n
  n = n - 1
end
```

## Grammar

Keywords are lower case. Spaces and tabs separate words, and each statement is on its own line. A
comment starts with `#` or `//` and runs to the end of the line.

```
program    = { line } ;
line       = [ statement ] [ comment ] newline ;
statement  = "input" name
           | "print" expression
           | name "=" expression
           | "if" condition "then" block [ "else" block ] "end"
           | "while" condition "do" block "end" ;
block      = { line } ;
condition  = expression compare expression ;
compare    = "==" | "!=" | "<" | "<=" | ">" | ">=" ;
expression = term { ( "+" | "-" ) term } ;
term       = factor { ( "*" | "/" | "%" ) factor } ;
factor     = number | name | "(" expression ")" | "-" factor ;
name       = letter { letter | digit | "_" } ;     (not a keyword)
number     = digit { digit } ;
```

`if`, `then`, `else`, `end`, `while`, `do`, `input` and `print` are keywords.

## Meaning

- **Variables.** Every value is an integer in the dialect's range: 0 to 999 in Classic, −999 to
  999 in the others.
  - A variable comes into being when it is first set (by `=` or `input`) anywhere in the
    program, and starts at 0.
  - Using a variable that is never set anywhere is an error.
- **Statements.**
  - `input x` reads the next input into `x`.
  - `print e` outputs the value of `e`.
  - When the last statement has run, the program stops.
- **Arithmetic.** `+` and `−` use the machine's ALU, so they wrap exactly as ADD and SUB do.
- **Multiplication and division.**
  - `*`, `/` and `%` have no instruction of their own: the compiler builds them from additions
    and subtractions in a loop.
  - They expect operands of 0 or more.
  - `/` and `%` by 0 give 0.
  - On the Classic target the loop is written out at each use. On the Extended target there is
    one shared subroutine, reached with CALL.
- **Comparisons.** A comparison works out `left − right` and tests it with BRZ and BRP.
  - It is exact whenever `left − right` fits in −999 to 999. That is always true in the Classic
    dialect.
  - In a signed dialect, comparing numbers of opposite signs whose difference is larger than
    999 can be wrong. The error notes say so.

## How each statement is compiled

The accumulator holds the value being worked on. The generated program has three parts:

1. The instructions.
2. A `HLT`.
3. One `DAT` for each variable, constant and temporary, in that order.

| Little Language        | LMC                                                    |
| ---------------------- | ------------------------------------------------------ |
| `input x`              | `INP`, `STA x`                                         |
| `print e`              | the code for `e`, then `OUT`                           |
| `x = e`                | the code for `e`, then `STA x`                         |
| `a + b` (b simple)     | the code for `a`, then `ADD b`                         |
| `a + b` (b not simple) | the code for `b`, `STA t1`, the code for `a`, `ADD t1` |
| a number or name       | `LDA` of its mailbox (numbers become `DAT` constants)  |
| `-a`                   | `LDA zero`, `SUB` of a                                 |

**Conditions.** With _d_ = left − right in the accumulator:

| Condition | If true, carry on; if false, jump to the end or `else` |
| --------- | ------------------------------------------------------ |
| `==`      | `BRZ yes`, `BRA no`, `yes:`                            |
| `!=`      | `BRZ no`                                               |
| `>=`      | `BRP yes`, `BRA no`, `yes:`                            |
| `<`       | `BRP no`                                               |
| `>`       | `BRZ no`, `BRP yes`, `BRA no`, `yes:`                  |
| `<=`      | `BRZ yes`, `BRP no`, `yes:`                            |

**if / else.**

1. The condition.
2. The `then` block, followed by `BRA` to the end (only if there is an `else`).
3. The `else` block.

**while.** A label at the top, then the condition (false jumps past the end), the block, and
`BRA` back to the top.

**Readable output.**

- Each statement's code starts with a comment that repeats the source line.
- Generated labels say what they are for: `while1`, `endwhile1`, `else2`, `endif2`, `yes3`.
- Variables keep their names. A name that is an LMC mnemonic or looks like a generated label
  gets `v_` in front: a variable `out` becomes `v_out`.

## The line-by-line mapping

Every generated LMC line records the Little Language line it came from:

- an instruction: the statement it compiles;
- the final `HLT`: the program's last line;
- a variable's `DAT`: the line where the variable is first set;
- a constant's or temporary's `DAT`: the line where it is first used.

Together with the assembler's own source map, this links:

- each Little Language line to its mailboxes;
- each mailbox back to a Little Language line.

The side-by-side view highlights both ways, and highlights both the current high-level line and
the current instruction while the program runs.

## Optimisation (optional)

When switched on, the compiler also:

1. **Folds constants.** `2 + 3 * 4` becomes `14` at compile time, when the result fits.
2. **Drops a reload.** An `LDA x` straight after `STA x` is removed, because the accumulator
   already holds x. It is kept when the `LDA` has a label, since something may jump to it.
3. **Drops a jump to the next line.** A `BRA L` straight before `L:` is removed.

The view shows the instruction counts with and without optimisation.

## Errors

Every error names the line and column, says what is wrong in plain language, and where possible
says how to fix it. For example:

- "Line 3: `while` needs `do` after its condition."
- "Line 5: `end` here does not close anything."
- "Line 2: `y` is used but never given a value. Set it with `y = ...` or `input y` first."
- "The compiled program needs 112 mailboxes, but LMC has 100. Shorten the program."
