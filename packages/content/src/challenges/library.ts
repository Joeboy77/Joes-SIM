/**
 * The challenge library (brief, 7.8 and 8.1). All text and programs are original to Joe's SIM and
 * licensed under CC BY 4.0. Targets are the model solution's own scores; tests check that every
 * solution passes and meets them, and that every starter program does not already pass.
 */
import { EXTENDED_CHALLENGES } from "./extended";
import { PERFORMANCE_CHALLENGES } from "./performance";
import type { Challenge } from "./types";

/** Source text, without the first line break, so programs can be written as indented blocks. */
const lmc = (s: string) => s.replace(/^\n/, "");
const T = (instructions: number, cycles: number, mailboxes: number) => ({
  instructions,
  cycles,
  mailboxes,
});

export const CHALLENGES: readonly Challenge[] = [
  // ---- First steps: input, output and arithmetic ----
  {
    id: "echo",
    title: "Echo",
    difficulty: 1,
    concepts: ["input-output"],
    dialect: "classic",
    kind: "build",
    description: "Read one number and output it.",
    starter: lmc(`
        HLT
`),
    tests: [
      { inputs: [5], outputs: [5] },
      { inputs: [42], outputs: [42] },
      { inputs: [0], outputs: [0] },
    ],
    targets: T(3, 3, 3),
    hints: [
      "Which instruction takes a number from the in-tray?",
      "INP puts the number in the accumulator. Which instruction shows the accumulator?",
      "Use INP, then OUT, then HLT.",
    ],
    solution: lmc(`
        INP
        OUT
        HLT
`),
  },
  {
    id: "sum-two-numbers",
    title: "Add two numbers",
    difficulty: 1,
    concepts: ["input-output", "arithmetic"],
    dialect: "classic",
    kind: "build",
    description: "Read two numbers and output their sum.",
    starter: lmc(`
        INP
        HLT
`),
    tests: [
      { inputs: [3, 4], outputs: [7] },
      { inputs: [10, 20], outputs: [30] },
      { inputs: [0, 0], outputs: [0] },
    ],
    targets: T(6, 6, 7),
    hints: [
      "You need somewhere to keep the first number while you read the second.",
      "STA copies the accumulator into a mailbox. Give the mailbox a name with DAT.",
      "INP, STA first, INP, ADD first, OUT, HLT, and first DAT at the end.",
    ],
    solution: lmc(`
        INP
        STA first
        INP
        ADD first
        OUT
        HLT
first   DAT
`),
  },
  {
    id: "echo-twice",
    title: "Say it twice",
    difficulty: 1,
    concepts: ["input-output"],
    dialect: "classic",
    kind: "build",
    description: "Read one number and output it two times.",
    starter: lmc(`
        INP
        HLT
`),
    tests: [
      { inputs: [7], outputs: [7, 7] },
      { inputs: [123], outputs: [123, 123] },
    ],
    targets: T(4, 4, 4),
    hints: [
      "Does OUT change the accumulator?",
      "OUT copies the accumulator to the out-tray and leaves it as it was.",
      "INP, OUT, OUT, HLT.",
    ],
    solution: lmc(`
        INP
        OUT
        OUT
        HLT
`),
  },
  {
    id: "swap-two",
    title: "Back to front",
    difficulty: 1,
    concepts: ["input-output"],
    dialect: "classic",
    kind: "build",
    description:
      "Read two numbers and output them in the opposite order: the second, then the first.",
    starter: lmc(`
        INP
        INP
        HLT
`),
    tests: [
      { inputs: [1, 2], outputs: [2, 1] },
      { inputs: [9, 4], outputs: [4, 9] },
    ],
    targets: T(7, 7, 8),
    hints: [
      "The second INP replaces the first number in the accumulator. Where can the first one wait?",
      "Store the first number in a mailbox, then you can output the second straight away.",
      "INP, STA a, INP, OUT, LDA a, OUT, HLT, with a DAT.",
    ],
    solution: lmc(`
        INP
        STA a
        INP
        OUT
        LDA a
        OUT
        HLT
a       DAT
`),
  },
  {
    id: "add-ten",
    title: "Add ten",
    difficulty: 1,
    concepts: ["arithmetic"],
    dialect: "classic",
    kind: "build",
    description: "Read a number and output that number plus 10.",
    starter: lmc(`
        INP
        OUT
        HLT
`),
    tests: [
      { inputs: [5], outputs: [15] },
      { inputs: [0], outputs: [10] },
      { inputs: [90], outputs: [100] },
    ],
    targets: T(4, 4, 5),
    hints: [
      "ADD adds the number in a mailbox. How can a mailbox hold 10?",
      "DAT 10 fills a mailbox with 10 before the program starts.",
      "INP, ADD ten, OUT, HLT, and ten DAT 10.",
    ],
    solution: lmc(`
        INP
        ADD ten
        OUT
        HLT
ten     DAT 10
`),
  },
  {
    id: "double",
    title: "Double it",
    difficulty: 1,
    concepts: ["arithmetic"],
    dialect: "classic",
    kind: "build",
    description: "Read a number and output twice that number.",
    starter: lmc(`
        INP
        OUT
        HLT
`),
    tests: [
      { inputs: [4], outputs: [8] },
      { inputs: [0], outputs: [0] },
      { inputs: [250], outputs: [500] },
    ],
    targets: T(5, 5, 6),
    hints: [
      "Doubling is adding a number to itself.",
      "ADD needs the number in a mailbox, so store it first.",
      "INP, STA n, ADD n, OUT, HLT, with n DAT.",
    ],
    solution: lmc(`
        INP
        STA n
        ADD n
        OUT
        HLT
n       DAT
`),
  },
  {
    id: "subtract-two",
    title: "Take away",
    difficulty: 1,
    concepts: ["arithmetic"],
    dialect: "classic",
    kind: "build",
    description:
      "Read two numbers and output the first minus the second. The first is never smaller than the second.",
    starter: lmc(`
        INP
        INP
        HLT
`),
    tests: [
      { inputs: [9, 4], outputs: [5] },
      { inputs: [7, 7], outputs: [0] },
      { inputs: [100, 1], outputs: [99] },
    ],
    targets: T(8, 8, 10),
    hints: [
      "SUB takes a mailbox's number away from the accumulator. Which number must be in the accumulator?",
      "Keep both numbers in mailboxes, then load the first and subtract the second.",
      "INP, STA a, INP, STA b, LDA a, SUB b, OUT, HLT.",
    ],
    solution: lmc(`
        INP
        STA a
        INP
        STA b
        LDA a
        SUB b
        OUT
        HLT
a       DAT
b       DAT
`),
  },
  {
    id: "two-constants",
    title: "Say 42 and 7",
    difficulty: 1,
    concepts: ["input-output"],
    dialect: "classic",
    kind: "build",
    description: "Without reading any input, output 42 and then 7.",
    starter: lmc(`
        HLT
`),
    tests: [{ inputs: [], outputs: [42, 7] }],
    targets: T(5, 5, 7),
    hints: [
      "Numbers can be placed in mailboxes before the program starts.",
      "DAT 42 holds 42. LDA copies a mailbox into the accumulator.",
      "LDA x, OUT, LDA y, OUT, HLT, with x DAT 42 and y DAT 7.",
    ],
    solution: lmc(`
        LDA x
        OUT
        LDA y
        OUT
        HLT
x       DAT 42
y       DAT 7
`),
  },
  {
    id: "add-three",
    title: "Add three numbers",
    difficulty: 2,
    concepts: ["arithmetic"],
    dialect: "classic",
    kind: "build",
    description: "Read three numbers and output their total.",
    starter: lmc(`
        INP
        HLT
`),
    tests: [
      { inputs: [1, 2, 3], outputs: [6] },
      { inputs: [100, 200, 300], outputs: [600] },
    ],
    targets: T(9, 9, 10),
    hints: [
      "Keep a running total in a mailbox.",
      "After each INP, add the total so far, then store the new total.",
      "INP, STA a, INP, ADD a, STA a, INP, ADD a, OUT, HLT.",
    ],
    solution: lmc(`
        INP
        STA a
        INP
        ADD a
        STA a
        INP
        ADD a
        OUT
        HLT
a       DAT
`),
  },
  {
    id: "triple",
    title: "Three times",
    difficulty: 2,
    concepts: ["arithmetic"],
    dialect: "classic",
    kind: "build",
    description: "Read a number and output three times that number.",
    starter: lmc(`
        INP
        OUT
        HLT
`),
    tests: [
      { inputs: [3], outputs: [9] },
      { inputs: [333], outputs: [999] },
      { inputs: [0], outputs: [0] },
    ],
    targets: T(6, 6, 7),
    hints: [
      "Three times a number is the number added to itself, twice.",
      "Store the number once; you can ADD the same mailbox again and again.",
      "INP, STA n, ADD n, ADD n, OUT, HLT.",
    ],
    solution: lmc(`
        INP
        STA n
        ADD n
        ADD n
        OUT
        HLT
n       DAT
`),
  },

  // ---- Decisions: branching ----
  {
    id: "max-of-two",
    title: "The bigger one",
    difficulty: 2,
    concepts: ["branching"],
    dialect: "classic",
    kind: "build",
    description: "Read two numbers and output the larger one. If they are equal, output either.",
    starter: lmc(`
        INP
        STA a
        INP
        STA b
        HLT
a       DAT
b       DAT
`),
    tests: [
      { inputs: [3, 8], outputs: [8] },
      { inputs: [8, 3], outputs: [8] },
      { inputs: [5, 5], outputs: [5] },
    ],
    targets: T(12, 9, 14),
    hints: [
      "Subtracting one number from the other tells you which is bigger.",
      "After b − a, BRP branches when the answer is zero or more, so when b is at least a.",
      "SUB a, then BRP to code that outputs b; otherwise load and output a.",
    ],
    solution: lmc(`
        INP
        STA a
        INP
        STA b
        SUB a
        BRP bbig
        LDA a
        OUT
        HLT
bbig    LDA b
        OUT
        HLT
a       DAT
b       DAT
`),
  },
  {
    id: "min-of-two",
    title: "The smaller one",
    difficulty: 2,
    concepts: ["branching"],
    dialect: "classic",
    kind: "build",
    description: "Read two numbers and output the smaller one. If they are equal, output either.",
    starter: lmc(`
        INP
        STA a
        INP
        STA b
        HLT
a       DAT
b       DAT
`),
    tests: [
      { inputs: [3, 8], outputs: [3] },
      { inputs: [8, 3], outputs: [3] },
      { inputs: [6, 6], outputs: [6] },
    ],
    targets: T(12, 9, 14),
    hints: [
      "This is the bigger-one puzzle turned round.",
      "If b − a is zero or more, a is the smaller (or they are equal).",
      "SUB a, BRP to code that outputs a; otherwise load and output b.",
    ],
    solution: lmc(`
        INP
        STA a
        INP
        STA b
        SUB a
        BRP amin
        LDA b
        OUT
        HLT
amin    LDA a
        OUT
        HLT
a       DAT
b       DAT
`),
  },
  {
    id: "is-zero",
    title: "Is it zero?",
    difficulty: 2,
    concepts: ["branching"],
    dialect: "classic",
    kind: "build",
    description: "Read a number. Output 1 if it is zero, and 0 if it is not.",
    starter: lmc(`
        INP
        HLT
`),
    tests: [
      { inputs: [0], outputs: [1] },
      { inputs: [5], outputs: [0] },
      { inputs: [999], outputs: [0] },
    ],
    targets: T(8, 5, 10),
    hints: [
      "Which branch instruction checks for zero?",
      "BRZ jumps when the accumulator is zero. Each path needs its own OUT and HLT.",
      "BRZ to code that loads a DAT 1 and outputs it; otherwise load a DAT 0 and output it.",
    ],
    solution: lmc(`
        INP
        BRZ zero
        LDA no
        OUT
        HLT
zero    LDA yes
        OUT
        HLT
yes     DAT 1
no      DAT 0
`),
  },
  {
    id: "equal",
    title: "Same or different",
    difficulty: 2,
    concepts: ["branching"],
    dialect: "classic",
    kind: "build",
    description: "Read two numbers. Output 1 if they are equal, and 0 if they are not.",
    starter: lmc(`
        INP
        INP
        HLT
`),
    tests: [
      { inputs: [4, 4], outputs: [1] },
      { inputs: [4, 5], outputs: [0] },
      { inputs: [9, 2], outputs: [0] },
    ],
    targets: T(11, 8, 14),
    hints: [
      "Two numbers are equal when their difference is zero.",
      "Store the first, subtract it from the second, and test with BRZ.",
      "INP, STA a, INP, SUB a, BRZ same; output 0 on one path and 1 on the other.",
    ],
    solution: lmc(`
        INP
        STA a
        INP
        SUB a
        BRZ same
        LDA no
        OUT
        HLT
same    LDA yes
        OUT
        HLT
a       DAT
yes     DAT 1
no      DAT 0
`),
  },
  {
    id: "over-100",
    title: "More than 100?",
    difficulty: 2,
    concepts: ["branching"],
    dialect: "classic",
    kind: "build",
    description: "Read a number. Output 1 if it is more than 100, and 0 if it is not.",
    starter: lmc(`
        INP
        HLT
`),
    tests: [
      { inputs: [150], outputs: [1] },
      { inputs: [100], outputs: [0] },
      { inputs: [101], outputs: [1] },
      { inputs: [5], outputs: [0] },
    ],
    targets: T(9, 6, 12),
    hints: [
      "BRP branches on zero or more. What can you subtract so that zero or more means 'more than 100'?",
      "n − 101 is zero or more exactly when n is more than 100.",
      "SUB a DAT 101, then BRP to the code that outputs 1.",
    ],
    solution: lmc(`
        INP
        SUB limit
        BRP big
        LDA no
        OUT
        HLT
big     LDA yes
        OUT
        HLT
limit   DAT 101
yes     DAT 1
no      DAT 0
`),
  },
  {
    id: "absolute-difference",
    title: "How far apart?",
    difficulty: 3,
    concepts: ["branching", "arithmetic"],
    dialect: "classic",
    kind: "build",
    description:
      "Read two numbers and output the difference between them, always as a positive number (or 0).",
    starter: lmc(`
        INP
        STA a
        INP
        STA b
        HLT
a       DAT
b       DAT
`),
    tests: [
      { inputs: [3, 8], outputs: [5] },
      { inputs: [8, 3], outputs: [5] },
      { inputs: [4, 4], outputs: [0] },
    ],
    targets: T(10, 10, 12),
    hints: [
      "Work out b − a first. When is that the answer?",
      "If b − a is zero or more, output it. If not, the answer is a − b instead.",
      "SUB a, BRP to OUT; otherwise LDA a, SUB b, then fall through to the same OUT.",
    ],
    solution: lmc(`
        INP
        STA a
        INP
        STA b
        SUB a
        BRP done
        LDA a
        SUB b
done    OUT
        HLT
a       DAT
b       DAT
`),
  },
  {
    id: "sign",
    title: "Which sign?",
    difficulty: 3,
    concepts: ["branching", "negative-numbers"],
    dialect: "higginson",
    kind: "build",
    description:
      "Read a number that may be negative. Output -1 if it is negative, 0 if it is zero and 1 if it is positive.",
    starter: lmc(`
        INP
        HLT
`),
    tests: [
      { inputs: [-5], outputs: [-1] },
      { inputs: [0], outputs: [0] },
      { inputs: [7], outputs: [1] },
    ],
    targets: T(11, 6, 13),
    hints: [
      "There are three cases, so you need two tests.",
      "Test for zero with BRZ first, because BRP also branches on zero.",
      "BRZ to an OUT (the accumulator is already 0), BRP to code that outputs 1, otherwise output -1.",
    ],
    solution: lmc(`
        INP
        BRZ zero
        BRP pos
        LDA minus
        OUT
        HLT
zero    OUT
        HLT
pos     LDA one
        OUT
        HLT
one     DAT 1
minus   DAT -1
`),
  },
  {
    id: "negate",
    title: "Flip the sign",
    difficulty: 2,
    concepts: ["negative-numbers", "arithmetic"],
    dialect: "higginson",
    kind: "build",
    description:
      "Read a number and output it with its sign flipped: 5 becomes -5, and -12 becomes 12.",
    starter: lmc(`
        INP
        OUT
        HLT
`),
    tests: [
      { inputs: [5], outputs: [-5] },
      { inputs: [-12], outputs: [12] },
      { inputs: [0], outputs: [0] },
    ],
    targets: T(6, 6, 7),
    hints: [
      "Flipping the sign is the same as taking the number away from zero.",
      "n − n is 0, and 0 − n is the answer.",
      "INP, STA n, SUB n, SUB n, OUT, HLT.",
    ],
    solution: lmc(`
        INP
        STA n
        SUB n
        SUB n
        OUT
        HLT
n       DAT
`),
  },

  // ---- Repetition: loops ----
  {
    id: "countdown",
    title: "Countdown",
    difficulty: 3,
    concepts: ["loops"],
    dialect: "classic",
    kind: "build",
    description: "Read a number n and output n, n−1, … down to 1. If n is 0, output nothing.",
    starter: lmc(`
        INP
        HLT
one     DAT 1
`),
    tests: [
      { inputs: [3], outputs: [3, 2, 1] },
      { inputs: [1], outputs: [1] },
      { inputs: [0], outputs: [] },
    ],
    targets: T(6, 15, 7),
    hints: [
      "A loop is a BRA back to an earlier mailbox. How does it stop?",
      "Check for zero at the top of the loop, before outputting.",
      "loop BRZ done, OUT, SUB one, BRA loop; done HLT.",
    ],
    solution: lmc(`
        INP
loop    BRZ done
        OUT
        SUB one
        BRA loop
done    HLT
one     DAT 1
`),
  },
  {
    id: "count-up",
    title: "Count up",
    difficulty: 3,
    concepts: ["loops"],
    dialect: "classic",
    kind: "build",
    description: "Read a number n (1 or more) and output 1, 2, … up to n.",
    starter: lmc(`
        INP
        STA n
        HLT
n       DAT
count   DAT 0
one     DAT 1
`),
    tests: [
      { inputs: [3], outputs: [1, 2, 3] },
      { inputs: [1], outputs: [1] },
      { inputs: [5], outputs: [1, 2, 3, 4, 5] },
    ],
    targets: T(10, 37, 13),
    hints: [
      "Keep a counter in a mailbox and add one to it each time round.",
      "After outputting the counter, stop when counter − n is zero.",
      "loop LDA count, ADD one, OUT, STA count, SUB n, BRZ done, BRA loop.",
    ],
    solution: lmc(`
        INP
        STA n
loop    LDA count
        ADD one
        OUT
        STA count
        SUB n
        BRZ done
        BRA loop
done    HLT
n       DAT
count   DAT 0
one     DAT 1
`),
  },
  {
    id: "sum-until-zero",
    title: "Total until zero",
    difficulty: 3,
    concepts: ["loops", "arithmetic"],
    dialect: "classic",
    kind: "build",
    description: "Read numbers until you read a 0, then output the total of the numbers before it.",
    starter: lmc(`
        INP
        HLT
total   DAT 0
`),
    tests: [
      { inputs: [5, 7, 0], outputs: [12] },
      { inputs: [0], outputs: [0] },
      { inputs: [100, 200, 300, 0], outputs: [600] },
    ],
    targets: T(8, 20, 9),
    hints: [
      "Read inside a loop, and leave the loop when the number is zero.",
      "Each time round: INP, BRZ out of the loop, ADD total, STA total.",
      "loop INP, BRZ done, ADD total, STA total, BRA loop; done LDA total, OUT, HLT.",
    ],
    solution: lmc(`
loop    INP
        BRZ done
        ADD total
        STA total
        BRA loop
done    LDA total
        OUT
        HLT
total   DAT 0
`),
  },
  {
    id: "count-inputs",
    title: "How many?",
    difficulty: 3,
    concepts: ["loops"],
    dialect: "classic",
    kind: "build",
    description: "Read numbers until you read a 0, then output how many numbers came before it.",
    starter: lmc(`
        INP
        HLT
`),
    tests: [
      { inputs: [4, 9, 2, 0], outputs: [3] },
      { inputs: [0], outputs: [0] },
      { inputs: [1, 0], outputs: [1] },
    ],
    targets: T(9, 23, 11),
    hints: [
      "You do not need the numbers themselves, only a count.",
      "Each time a number is not zero, add one to a counter mailbox.",
      "loop INP, BRZ done, LDA count, ADD one, STA count, BRA loop; then output count.",
    ],
    solution: lmc(`
loop    INP
        BRZ done
        LDA count
        ADD one
        STA count
        BRA loop
done    LDA count
        OUT
        HLT
count   DAT 0
one     DAT 1
`),
  },
  {
    id: "sum-n",
    title: "Add up n numbers",
    difficulty: 3,
    concepts: ["loops", "arithmetic"],
    dialect: "classic",
    kind: "build",
    description: "Read a number n, then read n more numbers and output their total.",
    starter: lmc(`
        INP
        STA n
        HLT
n       DAT
total   DAT 0
one     DAT 1
`),
    tests: [
      { inputs: [3, 1, 2, 3], outputs: [6] },
      { inputs: [0], outputs: [0] },
      { inputs: [1, 50], outputs: [50] },
    ],
    targets: T(13, 31, 16),
    hints: [
      "n says how many times the loop runs. Count it down.",
      "At the top of the loop, stop if n is zero; otherwise take one off n and read a number.",
      "loop LDA n, BRZ done, SUB one, STA n, INP, ADD total, STA total, BRA loop.",
    ],
    solution: lmc(`
        INP
        STA n
loop    LDA n
        BRZ done
        SUB one
        STA n
        INP
        ADD total
        STA total
        BRA loop
done    LDA total
        OUT
        HLT
n       DAT
total   DAT 0
one     DAT 1
`),
  },
  {
    id: "multiply",
    title: "Multiply",
    difficulty: 3,
    concepts: ["loops", "arithmetic"],
    dialect: "classic",
    kind: "build",
    description: "Read two numbers and output their product. LMC has no multiply instruction.",
    starter: lmc(`
        INP
        STA a
        INP
        STA b
        HLT
a       DAT
b       DAT
total   DAT 0
one     DAT 1
`),
    tests: [
      { inputs: [3, 4], outputs: [12] },
      { inputs: [7, 0], outputs: [0] },
      { inputs: [0, 5], outputs: [0] },
      { inputs: [12, 12], outputs: [144] },
    ],
    targets: T(15, 105, 19),
    hints: [
      "3 × 4 is 3 + 3 + 3 + 3.",
      "Add a to a total, b times. Count b down to zero.",
      "loop LDA b, BRZ done, SUB one, STA b, LDA total, ADD a, STA total, BRA loop.",
    ],
    solution: lmc(`
        INP
        STA a
        INP
        STA b
loop    LDA b
        BRZ done
        SUB one
        STA b
        LDA total
        ADD a
        STA total
        BRA loop
done    LDA total
        OUT
        HLT
a       DAT
b       DAT
total   DAT 0
one     DAT 1
`),
  },
  {
    id: "divide",
    title: "Share out",
    difficulty: 4,
    concepts: ["loops", "arithmetic"],
    dialect: "classic",
    kind: "build",
    description:
      "Read a and then b (b is at least 1). Output how many whole times b goes into a. For 17 and 5 the answer is 3.",
    starter: lmc(`
        INP
        STA a
        INP
        STA b
        HLT
a       DAT
b       DAT
count   DAT 0
one     DAT 1
`),
    tests: [
      { inputs: [17, 5], outputs: [3] },
      { inputs: [20, 5], outputs: [4] },
      { inputs: [3, 7], outputs: [0] },
    ],
    targets: T(15, 42, 19),
    hints: [
      "Division is repeated subtraction: how many times can you take b away?",
      "Subtract b from a; if the result is zero or more, keep it, count one, and go again.",
      "loop LDA a, SUB b, BRP keep (STA a, add one to count, BRA loop); otherwise output count.",
    ],
    solution: lmc(`
        INP
        STA a
        INP
        STA b
loop    LDA a
        SUB b
        BRP keep
        LDA count
        OUT
        HLT
keep    STA a
        LDA count
        ADD one
        STA count
        BRA loop
a       DAT
b       DAT
count   DAT 0
one     DAT 1
`),
  },
  {
    id: "remainder",
    title: "What is left over?",
    difficulty: 4,
    concepts: ["loops", "arithmetic"],
    dialect: "classic",
    kind: "build",
    description:
      "Read a and then b (b is at least 1). Output what is left when b is taken away from a as many times as possible. For 17 and 5 the answer is 2.",
    starter: lmc(`
        INP
        STA a
        INP
        STA b
        HLT
a       DAT
b       DAT
`),
    tests: [
      { inputs: [17, 5], outputs: [2] },
      { inputs: [20, 5], outputs: [0] },
      { inputs: [3, 7], outputs: [3] },
    ],
    targets: T(10, 18, 12),
    hints: [
      "Keep subtracting b until the answer goes below zero.",
      "When it goes below zero you have taken one b too many. Add it back.",
      "LDA a; loop SUB b, BRP loop; then ADD b and OUT.",
    ],
    solution: lmc(`
        INP
        STA a
        INP
        STA b
        LDA a
loop    SUB b
        BRP loop
        ADD b
        OUT
        HLT
a       DAT
b       DAT
`),
  },
  {
    id: "odd-or-even",
    title: "Odd or even",
    difficulty: 3,
    concepts: ["loops", "branching"],
    dialect: "classic",
    kind: "build",
    description: "Read a number. Output 0 if it is even and 1 if it is odd.",
    starter: lmc(`
        INP
        HLT
two     DAT 2
`),
    tests: [
      { inputs: [4], outputs: [0] },
      { inputs: [7], outputs: [1] },
      { inputs: [0], outputs: [0] },
      { inputs: [1], outputs: [1] },
    ],
    targets: T(6, 12, 7),
    hints: [
      "Take away 2 again and again. What is left at the end?",
      "Stop when the answer goes below zero, then add the 2 back.",
      "loop SUB two, BRP loop, ADD two, OUT, HLT.",
    ],
    solution: lmc(`
        INP
loop    SUB two
        BRP loop
        ADD two
        OUT
        HLT
two     DAT 2
`),
  },
  {
    id: "power-of-two",
    title: "Powers of two",
    difficulty: 4,
    concepts: ["loops", "arithmetic"],
    dialect: "classic",
    kind: "build",
    description: "Read n (0 to 9) and output 2 to the power n: 1, 2, 4, 8 and so on.",
    starter: lmc(`
        INP
        STA n
        HLT
n       DAT
p       DAT
one     DAT 1
`),
    tests: [
      { inputs: [0], outputs: [1] },
      { inputs: [3], outputs: [8] },
      { inputs: [9], outputs: [512] },
    ],
    targets: T(14, 81, 17),
    hints: [
      "Start at 1 and double it n times.",
      "Doubling is adding a number to itself. Count n down to zero as you go.",
      "Keep the answer in p; each time round, LDA p, ADD p, STA p, and take one off n.",
    ],
    solution: lmc(`
        INP
        STA n
        LDA one
loop    STA p
        LDA n
        BRZ done
        SUB one
        STA n
        LDA p
        ADD p
        BRA loop
done    LDA p
        OUT
        HLT
n       DAT
p       DAT
one     DAT 1
`),
  },
  {
    id: "square",
    title: "Square it",
    difficulty: 4,
    concepts: ["loops", "arithmetic"],
    dialect: "classic",
    kind: "build",
    description: "Read a number n (up to 31) and output n × n.",
    starter: lmc(`
        INP
        STA n
        HLT
n       DAT
`),
    tests: [
      { inputs: [4], outputs: [16] },
      { inputs: [0], outputs: [0] },
      { inputs: [31], outputs: [961] },
    ],
    targets: T(14, 256, 18),
    hints: [
      "This is multiplying n by itself.",
      "You need n twice: once to add, and once as a counter that goes down.",
      "Store n in n and in count, then add n to a total count times.",
    ],
    solution: lmc(`
        INP
        STA n
        STA count
loop    LDA count
        BRZ done
        SUB one
        STA count
        LDA total
        ADD n
        STA total
        BRA loop
done    LDA total
        OUT
        HLT
n       DAT
count   DAT
total   DAT 0
one     DAT 1
`),
  },
  {
    id: "times-table",
    title: "Times table",
    difficulty: 3,
    concepts: ["loops"],
    dialect: "classic",
    kind: "build",
    description:
      "Read a number n and output the first five lines of its times table: n, 2n, 3n, 4n and 5n.",
    starter: lmc(`
        INP
        STA n
        HLT
n       DAT
`),
    tests: [
      { inputs: [3], outputs: [3, 6, 9, 12, 15] },
      { inputs: [7], outputs: [7, 14, 21, 28, 35] },
    ],
    targets: T(12, 47, 16),
    hints: [
      "Each answer is the one before plus n.",
      "Keep a running total and a counter that starts at 5.",
      "loop LDA total, ADD n, STA total, OUT, then take one off count and BRZ done.",
    ],
    solution: lmc(`
        INP
        STA n
loop    LDA total
        ADD n
        STA total
        OUT
        LDA count
        SUB one
        STA count
        BRZ done
        BRA loop
done    HLT
n       DAT
total   DAT 0
count   DAT 5
one     DAT 1
`),
  },
  {
    id: "max-of-list",
    title: "The biggest",
    difficulty: 4,
    concepts: ["loops", "branching"],
    dialect: "classic",
    kind: "build",
    description:
      "Read numbers until you read a 0, then output the largest number read (0 if there were none).",
    starter: lmc(`
loop    INP
        BRZ done
        BRA loop
done    HLT
`),
    tests: [
      { inputs: [3, 9, 4, 0], outputs: [9] },
      { inputs: [5, 0], outputs: [5] },
      { inputs: [0], outputs: [0] },
      { inputs: [2, 2, 1, 0], outputs: [2] },
    ],
    targets: T(12, 27, 14),
    hints: [
      "Keep the biggest so far in a mailbox, starting at 0.",
      "For each number x, work out x − max. If it is zero or more, x is the new biggest.",
      "STA x, SUB max, BRP to code that does LDA x, STA max; then back to the loop.",
    ],
    solution: lmc(`
loop    INP
        BRZ done
        STA x
        SUB max
        BRP bigger
        BRA loop
bigger  LDA x
        STA max
        BRA loop
done    LDA max
        OUT
        HLT
x       DAT
max     DAT 0
`),
  },
  {
    id: "fibonacci",
    title: "Fibonacci",
    difficulty: 4,
    concepts: ["loops", "arithmetic"],
    dialect: "classic",
    kind: "build",
    description:
      "Read n and output the first n Fibonacci numbers: 1, 1, 2, 3, 5, 8… Each is the sum of the two before it.",
    starter: lmc(`
        INP
        STA n
        HLT
n       DAT
a       DAT 1
b       DAT 1
`),
    tests: [
      { inputs: [5], outputs: [1, 1, 2, 3, 5] },
      { inputs: [1], outputs: [1] },
      { inputs: [0], outputs: [] },
      { inputs: [10], outputs: [1, 1, 2, 3, 5, 8, 13, 21, 34, 55] },
    ],
    targets: T(16, 135, 21),
    hints: [
      "Keep the last two numbers, a and b, in mailboxes.",
      "Output a, then the next pair is b and a + b.",
      "Work out a + b into next, then copy b into a and next into b.",
    ],
    solution: lmc(`
        INP
        STA n
loop    LDA n
        BRZ done
        SUB one
        STA n
        LDA a
        OUT
        ADD b
        STA next
        LDA b
        STA a
        LDA next
        STA b
        BRA loop
done    HLT
n       DAT
a       DAT 1
b       DAT 1
next    DAT
one     DAT 1
`),
  },
  {
    id: "triangular",
    title: "Triangle numbers",
    difficulty: 3,
    concepts: ["loops", "arithmetic"],
    dialect: "classic",
    kind: "build",
    description: "Read n and output 1 + 2 + … + n. For 4 the answer is 10.",
    starter: lmc(`
        INP
        HLT
`),
    tests: [
      { inputs: [4], outputs: [10] },
      { inputs: [0], outputs: [0] },
      { inputs: [10], outputs: [55] },
      { inputs: [44], outputs: [990] },
    ],
    targets: T(11, 313, 14),
    hints: [
      "Add n, then n − 1, and so on down to 1.",
      "Use n itself as the counter: add it to the total, then take one off.",
      "loop BRZ done, STA n, ADD total, STA total, LDA n, SUB one, BRA loop.",
    ],
    solution: lmc(`
        INP
loop    BRZ done
        STA n
        ADD total
        STA total
        LDA n
        SUB one
        BRA loop
done    LDA total
        OUT
        HLT
n       DAT
total   DAT 0
one     DAT 1
`),
  },
  {
    id: "gcd",
    title: "Greatest common divisor",
    difficulty: 5,
    concepts: ["loops", "branching"],
    dialect: "classic",
    kind: "build",
    description:
      "Read two numbers (both at least 1) and output the largest number that divides both. For 12 and 18 the answer is 6.",
    starter: lmc(`
        INP
        STA a
        INP
        STA b
        HLT
a       DAT
b       DAT
`),
    tests: [
      { inputs: [12, 18], outputs: [6] },
      { inputs: [7, 5], outputs: [1] },
      { inputs: [9, 9], outputs: [9] },
    ],
    targets: T(17, 38, 19),
    hints: [
      "Euclid's idea: take the smaller number away from the larger until they are equal.",
      "Work out a − b. Zero means you are done; zero or more means a is larger; otherwise b is.",
      "loop LDA a, SUB b, BRZ done, BRP to STA a; otherwise LDA b, SUB a, STA b; BRA loop.",
    ],
    solution: lmc(`
        INP
        STA a
        INP
        STA b
loop    LDA a
        SUB b
        BRZ done
        BRP abig
        LDA b
        SUB a
        STA b
        BRA loop
abig    STA a
        BRA loop
done    LDA a
        OUT
        HLT
a       DAT
b       DAT
`),
  },

  // ---- Characters (OTC) ----
  {
    id: "say-hi",
    title: "Say HI",
    difficulty: 2,
    concepts: ["characters", "input-output"],
    dialect: "higginson",
    kind: "build",
    description:
      "Output the letters H and I using OTC. The character code for H is 72 and for I is 73.",
    starter: lmc(`
        HLT
`),
    tests: [{ inputs: [], outputs: ["H", "I"] }],
    targets: T(5, 5, 7),
    hints: [
      "OTC outputs the accumulator as a character instead of a number.",
      "Put 72 and 73 in mailboxes with DAT, and load each in turn.",
      "LDA h, OTC, LDA i, OTC, HLT, with h DAT 72 and i DAT 73.",
    ],
    solution: lmc(`
        LDA h
        OTC
        LDA i
        OTC
        HLT
h       DAT 72
i       DAT 73
`),
  },
  {
    id: "digit-char",
    title: "Number to character",
    difficulty: 2,
    concepts: ["characters", "arithmetic"],
    dialect: "higginson",
    kind: "build",
    description:
      "Read a digit from 0 to 9 and output it as a character. The code for the character 0 is 48, for 1 it is 49, and so on.",
    starter: lmc(`
        INP
        OTC
        HLT
`),
    tests: [
      { inputs: [7], outputs: ["7"] },
      { inputs: [0], outputs: ["0"] },
      { inputs: [9], outputs: ["9"] },
    ],
    targets: T(4, 4, 5),
    hints: [
      "OTC 7 outputs the character with code 7, which is not the digit 7.",
      "The digit characters start at code 48.",
      "INP, ADD a DAT 48, OTC, HLT.",
    ],
    solution: lmc(`
        INP
        ADD zero
        OTC
        HLT
zero    DAT 48
`),
  },
  {
    id: "stars",
    title: "A row of stars",
    difficulty: 3,
    concepts: ["characters", "loops"],
    dialect: "higginson",
    kind: "build",
    description: "Read n and output n star characters (code 42).",
    starter: lmc(`
        INP
        HLT
star    DAT 42
one     DAT 1
`),
    tests: [
      { inputs: [3], outputs: ["*", "*", "*"] },
      { inputs: [0], outputs: [] },
      { inputs: [1], outputs: ["*"] },
    ],
    targets: T(9, 24, 12),
    hints: [
      "This is a countdown loop that outputs a star instead of the number.",
      "Loading the star changes the accumulator, so keep the count in a mailbox.",
      "loop BRZ done, SUB one, STA n, LDA star, OTC, LDA n, BRA loop.",
    ],
    solution: lmc(`
        INP
loop    BRZ done
        SUB one
        STA n
        LDA star
        OTC
        LDA n
        BRA loop
done    HLT
n       DAT
star    DAT 42
one     DAT 1
`),
  },

  // ---- Arrays, with self-modifying code ----
  {
    id: "lookup-table",
    title: "Look it up",
    difficulty: 4,
    concepts: ["arrays"],
    dialect: "classic",
    kind: "build",
    description:
      "The program holds a table of the squares 0, 1, 4, … 81. Read a number i from 0 to 9 and output entry i of the table.",
    starter: lmc(`
        INP
        HLT
table   DAT 0
        DAT 1
        DAT 4
        DAT 9
        DAT 16
        DAT 25
        DAT 36
        DAT 49
        DAT 64
        DAT 81
`),
    tests: [
      { inputs: [3], outputs: [9] },
      { inputs: [0], outputs: [0] },
      { inputs: [9], outputs: [81] },
    ],
    targets: T(7, 6, 17),
    hints: [
      "LDA table loads entry 0. The instruction for entry i is that instruction plus i.",
      "Instructions are numbers too: you can add i to an LDA instruction and store the result where it will run.",
      "Keep 'load LDA table' as data. INP, ADD load, STA fetch, then fetch runs the new LDA, then OUT.",
    ],
    solution: lmc(`
        INP
        ADD load
        STA fetch
fetch   LDA table
        OUT
        HLT
load    LDA table
table   DAT 0
        DAT 1
        DAT 4
        DAT 9
        DAT 16
        DAT 25
        DAT 36
        DAT 49
        DAT 64
        DAT 81
`),
  },
  {
    id: "sum-table",
    title: "Add up a table",
    difficulty: 4,
    concepts: ["arrays", "loops"],
    dialect: "classic",
    kind: "build",
    description:
      "The program holds a table of five numbers. Read n from 0 to 5 and output the total of the first n entries.",
    starter: lmc(`
        INP
        HLT
total   DAT 0
one     DAT 1
table   DAT 3
        DAT 1
        DAT 4
        DAT 1
        DAT 5
`),
    tests: [
      { inputs: [0], outputs: [0] },
      { inputs: [3], outputs: [8] },
      { inputs: [5], outputs: [14] },
    ],
    targets: T(15, 55, 23),
    hints: [
      "Count n down. The entry to add each time is entry n − 1.",
      "Build the instruction LDA table + index by adding the index to an LDA table kept as data.",
      "loop BRZ done, SUB one, STA n, ADD load, STA get; get loads the entry; ADD total, STA total, LDA n, BRA loop.",
    ],
    solution: lmc(`
        INP
loop    BRZ done
        SUB one
        STA n
        ADD load
        STA get
get     LDA table
        ADD total
        STA total
        LDA n
        BRA loop
done    LDA total
        OUT
        HLT
n       DAT
total   DAT 0
one     DAT 1
load    LDA table
table   DAT 3
        DAT 1
        DAT 4
        DAT 1
        DAT 5
`),
  },
  {
    id: "reverse-list",
    title: "Backwards",
    difficulty: 5,
    concepts: ["arrays", "loops"],
    dialect: "classic",
    kind: "build",
    description:
      "Read n (0 to 5), then n numbers. Output the numbers in the opposite order. You will need an array.",
    starter: lmc(`
        INP
        STA n
        HLT
n       DAT
one     DAT 1
arr     DAT
        DAT
        DAT
        DAT
        DAT
`),
    tests: [
      { inputs: [3, 1, 2, 3], outputs: [3, 2, 1] },
      { inputs: [1, 9], outputs: [9] },
      { inputs: [5, 10, 20, 30, 40, 50], outputs: [50, 40, 30, 20, 10] },
      { inputs: [0], outputs: [] },
    ],
    targets: T(27, 114, 36),
    hints: [
      "Store each number in the array, then read the array back the other way.",
      "Store with a counter that goes down from n − 1, then output from entry 0 upwards.",
      "Build 'STA arr + i' and 'LDA arr + j' by adding the index to an STA and an LDA kept as data.",
    ],
    solution: lmc(`
        INP
        STA n
        STA i
read    LDA i
        BRZ write
        SUB one
        STA i
        ADD store
        STA put
        INP
put     STA arr
        BRA read
write   LDA j
        SUB n
        BRZ done
        LDA j
        ADD load
        STA get
get     LDA arr
        OUT
        LDA j
        ADD one
        STA j
        BRA write
done    HLT
n       DAT
i       DAT
j       DAT 0
one     DAT 1
store   STA arr
load    LDA arr
arr     DAT
        DAT
        DAT
        DAT
        DAT
`),
  },

  // ---- Subroutines ----
  {
    id: "double-subroutine",
    title: "A doubling subroutine",
    difficulty: 5,
    concepts: ["subroutines"],
    dialect: "classic",
    kind: "build",
    description:
      "Read a and output 2a, then read b and output 2b. Write the doubling once, as a subroutine both parts use.",
    starter: lmc(`
        INP
        OUT
        INP
        OUT
        HLT
`),
    tests: [
      { inputs: [3, 4], outputs: [6, 8] },
      { inputs: [0, 250], outputs: [0, 500] },
    ],
    targets: T(16, 17, 17),
    hints: [
      "LMC has no call instruction. The subroutine ends with a BRA whose address the caller fills in.",
      "Before jumping to the subroutine, store a 'BRA back-here' instruction into its last mailbox.",
      "Keep 'ret1 BRA r1' as data. LDA ret1, STA back, INP, BRA double; r1 OUT. The subroutine is STA t, ADD t, back BRA 0.",
    ],
    solution: lmc(`
        LDA ret1
        STA back
        INP
        BRA double
r1      OUT
        LDA ret2
        STA back
        INP
        BRA double
r2      OUT
        HLT
double  STA t
        ADD t
back    BRA 0
t       DAT
ret1    BRA r1
ret2    BRA r2
`),
  },

  // ---- Bug hunts ----
  {
    id: "bug-wrong-mailbox",
    title: "Bug hunt: the missing number",
    difficulty: 1,
    concepts: ["debugging", "arithmetic"],
    dialect: "classic",
    kind: "bug-hunt",
    description:
      "This program should output the sum of two numbers, but it outputs only the second. Fix it.",
    starter: lmc(`
        INP
        STA first
        INP
        ADD second
        OUT
        HLT
first   DAT
second  DAT
`),
    tests: [
      { inputs: [3, 4], outputs: [7] },
      { inputs: [10, 5], outputs: [15] },
    ],
    targets: T(6, 6, 7),
    hints: [
      "Step through and watch which mailbox ADD reads.",
      "The first number is stored in 'first', but ADD reads 'second', which is still 0.",
      "Change ADD second to ADD first. The 'second' mailbox is not needed.",
    ],
    solution: lmc(`
        INP
        STA first
        INP
        ADD first
        OUT
        HLT
first   DAT
`),
  },
  {
    id: "bug-countdown-zero",
    title: "Bug hunt: one too many",
    difficulty: 2,
    concepts: ["debugging", "loops"],
    dialect: "classic",
    kind: "bug-hunt",
    description: "This countdown should output n down to 1, but it also outputs 0. Fix it.",
    starter: lmc(`
        INP
loop    OUT
        SUB one
        BRP loop
        HLT
one     DAT 1
`),
    tests: [
      { inputs: [3], outputs: [3, 2, 1] },
      { inputs: [1], outputs: [1] },
      { inputs: [0], outputs: [] },
    ],
    targets: T(6, 15, 7),
    hints: [
      "What does BRP do when the accumulator is exactly 0?",
      "Zero counts as positive, so BRP loops once more and outputs 0.",
      "Test for zero before outputting: loop BRZ done, OUT, SUB one, BRA loop.",
    ],
    solution: lmc(`
        INP
loop    BRZ done
        OUT
        SUB one
        BRA loop
done    HLT
one     DAT 1
`),
  },
  {
    id: "bug-swapped-branch",
    title: "Bug hunt: the wrong winner",
    difficulty: 2,
    concepts: ["debugging", "branching"],
    dialect: "classic",
    kind: "bug-hunt",
    description:
      "This program should output the larger of two numbers, but it outputs the smaller. Fix it.",
    starter: lmc(`
        INP
        STA a
        INP
        STA b
        SUB a
        BRP bbig
        LDA b
        OUT
        HLT
bbig    LDA a
        OUT
        HLT
a       DAT
b       DAT
`),
    tests: [
      { inputs: [3, 8], outputs: [8] },
      { inputs: [8, 3], outputs: [8] },
      { inputs: [5, 5], outputs: [5] },
    ],
    targets: T(12, 9, 14),
    hints: [
      "When does BRP branch here, and which number is bigger then?",
      "BRP branches when b − a is zero or more, which means b is the bigger one.",
      "Swap the two loads: output b when BRP branches, and a otherwise.",
    ],
    solution: lmc(`
        INP
        STA a
        INP
        STA b
        SUB a
        BRP bbig
        LDA a
        OUT
        HLT
bbig    LDA b
        OUT
        HLT
a       DAT
b       DAT
`),
  },
  {
    id: "bug-lost-total",
    title: "Bug hunt: the total that never grows",
    difficulty: 3,
    concepts: ["debugging", "loops"],
    dialect: "classic",
    kind: "bug-hunt",
    description: "This program should total numbers until a 0, but it always outputs 0. Fix it.",
    starter: lmc(`
loop    INP
        BRZ done
        ADD total
        BRA loop
done    LDA total
        OUT
        HLT
total   DAT 0
`),
    tests: [
      { inputs: [5, 7, 0], outputs: [12] },
      { inputs: [0], outputs: [0] },
    ],
    targets: T(8, 15, 9),
    hints: [
      "Watch the mailbox 'total' while the program runs. Does it ever change?",
      "ADD total works out the new total in the accumulator, but nothing writes it back.",
      "Add STA total after ADD total.",
    ],
    solution: lmc(`
loop    INP
        BRZ done
        ADD total
        STA total
        BRA loop
done    LDA total
        OUT
        HLT
total   DAT 0
`),
  },
  {
    id: "bug-off-by-one",
    title: "Bug hunt: the extra helping",
    difficulty: 3,
    concepts: ["debugging", "loops", "arithmetic"],
    dialect: "classic",
    kind: "bug-hunt",
    description: "This program should multiply two numbers, but its answers are too big. Fix it.",
    starter: lmc(`
        INP
        STA a
        INP
        STA b
loop    LDA total
        ADD a
        STA total
        LDA b
        SUB one
        STA b
        BRP loop
        LDA total
        OUT
        HLT
a       DAT
b       DAT
total   DAT 0
one     DAT 1
`),
    tests: [
      { inputs: [3, 4], outputs: [12] },
      { inputs: [7, 0], outputs: [0] },
    ],
    targets: T(15, 41, 19),
    hints: [
      "Count how many times a is added when b is 4.",
      "The loop adds before it checks, and BRP also loops when b reaches 0.",
      "Check b at the top: loop LDA b, BRZ done, SUB one, STA b, then add a, then BRA loop.",
    ],
    solution: lmc(`
        INP
        STA a
        INP
        STA b
loop    LDA b
        BRZ done
        SUB one
        STA b
        LDA total
        ADD a
        STA total
        BRA loop
done    LDA total
        OUT
        HLT
a       DAT
b       DAT
total   DAT 0
one     DAT 1
`),
  },
  {
    id: "bug-stuck-counter",
    title: "Bug hunt: the endless count",
    difficulty: 3,
    concepts: ["debugging", "loops"],
    dialect: "classic",
    kind: "bug-hunt",
    description: "This program should output 1 up to n, but it never stops. Fix it.",
    starter: lmc(`
        INP
        STA n
loop    LDA count
        ADD one
        OUT
        SUB n
        BRZ done
        BRA loop
done    HLT
n       DAT
count   DAT 0
one     DAT 1
`),
    tests: [
      { inputs: [3], outputs: [1, 2, 3] },
      { inputs: [1], outputs: [1] },
    ],
    targets: T(10, 23, 13),
    hints: [
      "Watch 'count' as the loop goes round. What should happen to it?",
      "The new count is worked out and output, but never stored, so every trip starts from 0 again.",
      "Add STA count after OUT.",
    ],
    solution: lmc(`
        INP
        STA n
loop    LDA count
        ADD one
        OUT
        STA count
        SUB n
        BRZ done
        BRA loop
done    HLT
n       DAT
count   DAT 0
one     DAT 1
`),
  },
  // ---- The extended machine: stack, subroutines, addressing modes, interrupts, devices ----
  ...EXTENDED_CHALLENGES,
  // ---- Pipelines and caches ----
  ...PERFORMANCE_CHALLENGES,
];
