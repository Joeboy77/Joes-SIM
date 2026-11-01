/**
 * Challenges for the extended machine (Phase 6): the stack, subroutines, addressing modes,
 * interrupts and devices. Original to Joe's SIM, CC BY 4.0. Targets are the model solutions'
 * own scores.
 */
import type { Challenge } from "./types";

const lmc = (s: string) => s.replace(/^\n/, "");
const T = (instructions: number, cycles: number, mailboxes: number) => ({
  instructions,
  cycles,
  mailboxes,
});

export const EXTENDED_CHALLENGES: readonly Challenge[] = [
  {
    id: "stack-reverse",
    title: "Backwards with the stack",
    difficulty: 2,
    concepts: ["stack"],
    dialect: "classic",
    machine: "extended",
    kind: "build",
    description:
      "Read three numbers and output them in reverse order. Use PUSH and POP instead of DAT mailboxes.",
    starter: lmc(`
        INP
        HLT
`),
    tests: [
      { inputs: [1, 2, 3], outputs: [3, 2, 1] },
      { inputs: [7, 0, 5], outputs: [5, 0, 7] },
    ],
    targets: T(11, 11, 11),
    hints: [
      "The stack gives back the last thing put on it first. How does that help?",
      "PUSH each number as you read it. Which one will POP give back first?",
      "INP, PUSH, INP, PUSH, INP, OUT; then POP, OUT twice; then HLT.",
    ],
    solution: lmc(`
        INP
        PUSH
        INP
        PUSH
        INP
        OUT             // the last number is still in the accumulator
        POP
        OUT
        POP
        OUT
        HLT
`),
  },
  {
    id: "subroutine-double",
    title: "Call a subroutine twice",
    difficulty: 2,
    concepts: ["subroutines", "stack"],
    dialect: "classic",
    machine: "extended",
    kind: "build",
    description:
      "Read two numbers and output each one doubled. Write the doubling once, as a subroutine, and CALL it for each number.",
    starter: lmc(`
        INP
        HLT
double  RET
`),
    tests: [
      { inputs: [3, 4], outputs: [6, 8] },
      { inputs: [0, 50], outputs: [0, 100] },
    ],
    targets: T(10, 13, 13),
    hints: [
      "CALL remembers where it came from, so RET can go back there.",
      "The subroutine gets the number in the accumulator. How do you add a number to itself?",
      "In the subroutine: STA tmp, ADD tmp, RET. In the main program: INP, CALL double, OUT, twice.",
    ],
    solution: lmc(`
        INP
        CALL double
        OUT
        INP
        CALL double
        OUT
        HLT
double  STA tmp
        ADD tmp
        RET
tmp     DAT
`),
  },
  {
    id: "squares-table",
    title: "Look it up in a table",
    difficulty: 3,
    concepts: ["addressing-modes", "arrays"],
    dialect: "classic",
    machine: "extended",
    kind: "build",
    description:
      "Read a number from 0 to 4 and output its square, by looking it up in the table with indexed addressing (LDA squares,X).",
    starter: lmc(`
        INP
        HLT
n       DAT
squares DAT 0
        DAT 1
        DAT 4
        DAT 9
        DAT 16
`),
    tests: [
      { inputs: [0], outputs: [0] },
      { inputs: [3], outputs: [9] },
      { inputs: [4], outputs: [16] },
    ],
    targets: T(6, 6, 14),
    hints: [
      "Indexed addressing adds X to the address. How do you get the number into X?",
      "LDX loads X from a mailbox, so store the number first.",
      "INP, STA n, LDX n, LDA squares,X, OUT, HLT.",
    ],
    solution: lmc(`
        INP
        STA n
        LDX n
        LDA squares,X   // the mailbox squares + X
        OUT
        HLT
n       DAT
squares DAT 0
        DAT 1
        DAT 4
        DAT 9
        DAT 16
`),
  },
  {
    id: "pointer-walk",
    title: "Follow the pointer",
    difficulty: 3,
    concepts: ["addressing-modes", "loops"],
    dialect: "classic",
    machine: "extended",
    kind: "build",
    description:
      "Output every number in the list, stopping at the 0 that ends it. Use a pointer with indirect addressing (LDA @ptr), and move the pointer on each time.",
    starter: lmc(`
        HLT
ptr     DAT list
one     DAT 1
list    DAT 5
        DAT 8
        DAT 13
        DAT 0
`),
    tests: [{ inputs: [], outputs: [5, 8, 13] }],
    targets: T(8, 24, 15),
    hints: [
      "ptr holds the address of a number, not the number. Which instruction follows it?",
      "LDA @ptr loads the number ptr points to. Then add one to ptr itself.",
      "Loop: LDA @ptr, BRZ done, OUT, LDA ptr, ADD one, STA ptr, BRA loop.",
    ],
    solution: lmc(`
loop    LDA @ptr        // the number ptr points to
        BRZ done
        OUT
        LDA ptr         // move the pointer on
        ADD one
        STA ptr
        BRA loop
done    HLT
ptr     DAT list
one     DAT 1
list    DAT 5
        DAT 8
        DAT 13
        DAT 0
`),
  },
  {
    id: "timer-ticks",
    title: "Count the ticks",
    difficulty: 4,
    concepts: ["interrupts", "devices"],
    dialect: "classic",
    machine: "extended",
    kind: "build",
    description:
      "Set the timer to interrupt every 10 instructions. Each time it does, output how many ticks there have been. Stop after the third.",
    starter: lmc(`
        VEC tick
        HLT
tick    RTI
`),
    tests: [{ inputs: [], outputs: [1, 2, 3] }],
    targets: T(14, 43, 20),
    hints: [
      "The timer only interrupts when interrupts are on, and it needs a period on port 20.",
      "PUT 20 with 10 in the accumulator starts the timer; EI turns interrupts on; WAIT idles.",
      "The handler adds one to a count, outputs it, and halts when it reaches 3; otherwise RTI.",
    ],
    solution: lmc(`
        VEC tick
        LDA period
        PUT 20          // a timer interrupt every 10 instructions
        EI
idle    WAIT
        BRA idle
tick    LDA count
        ADD one
        STA count
        OUT
        SUB three
        BRZ done
        RTI
done    HLT
period  DAT 10
count   DAT 0
one     DAT 1
three   DAT 3
`),
  },
  {
    id: "key-codes",
    title: "What key was that?",
    difficulty: 4,
    concepts: ["interrupts", "devices", "characters"],
    dialect: "classic",
    machine: "extended",
    kind: "build",
    description:
      "Each time a key is pressed, output its code. Stop when Enter (code 10) is pressed. Use the keyboard interrupt.",
    starter: lmc(`
        HLT
`),
    tests: [
      {
        inputs: [],
        keys: [
          { cycle: 5, key: 65 },
          { cycle: 9, key: 66 },
          { cycle: 20, key: 10 },
        ],
        outputs: [65, 66],
      },
      {
        inputs: [],
        keys: [
          { cycle: 3, key: 49 },
          { cycle: 3, key: 10 },
        ],
        outputs: [49],
      },
    ],
    targets: T(12, 26, 16),
    hints: [
      "A key press raises a keyboard interrupt. What do you need before interrupts can happen?",
      "VEC says where the handler is, and EI turns interrupts on. GET 2 reads the next key.",
      "Handler: GET 2, STA k, SUB enter, BRZ done, LDA k, OUT, RTI. Main program: VEC, EI, then WAIT in a loop.",
    ],
    solution: lmc(`
        VEC key
        EI
idle    WAIT
        BRA idle
key     GET 2           // the key's code
        STA k
        SUB enter
        BRZ done
        LDA k
        OUT
        RTI
done    HLT
k       DAT
enter   DAT 10
`),
  },
  {
    id: "red-line",
    title: "Draw a red line",
    difficulty: 3,
    concepts: ["devices", "loops"],
    dialect: "classic",
    machine: "extended",
    kind: "build",
    description:
      "Colour the whole top row of the pixel display red (colour 4), then stop. PUT 11 colours the chosen pixel and moves on to the next.",
    starter: lmc(`
        HLT
red     DAT 4
`),
    tests: [
      {
        inputs: [],
        outputs: [],
        pixels: Array.from({ length: 16 }, (_, i) => [i, 4] as const),
      },
    ],
    targets: T(9, 128, 14),
    hints: [
      "The top row is pixels 0 to 15, and pixel 0 is chosen when the program starts.",
      "PUT 11 sends a colour and moves on one pixel. You need to do that 16 times.",
      "Keep a count; each time round, LDA red, PUT 11, then add one to the count and stop at 16.",
    ],
    solution: lmc(`
loop    LDA red
        PUT 11          // colour this pixel, then move to the next
        LDA count
        ADD one
        STA count
        SUB sixteen
        BRZ done
        BRA loop
done    HLT
red     DAT 4
count   DAT 0
one     DAT 1
sixteen DAT 16
`),
  },
  {
    id: "bug-no-return",
    title: "Bug hunt: the subroutine that never came back",
    difficulty: 3,
    concepts: ["debugging", "subroutines"],
    dialect: "classic",
    machine: "extended",
    kind: "bug-hunt",
    description:
      "This program should read a number and output three times it, using a subroutine. It never outputs anything. Find out why and fix it.",
    starter: lmc(`
        INP
        CALL triple
        OUT
        HLT
triple  STA t
        ADD t
        ADD t
t       DAT
`),
    tests: [
      { inputs: [2], outputs: [6] },
      { inputs: [5], outputs: [15] },
    ],
    targets: T(8, 8, 10),
    hints: [
      "Step through it. What does the machine run after the last ADD?",
      "After ADD t it runs the DAT as an instruction, because nothing sends it back.",
      "End the subroutine with RET, so it returns to the OUT after the CALL.",
    ],
    solution: lmc(`
        INP
        CALL triple
        OUT
        HLT
triple  STA t
        ADD t
        ADD t
        RET
t       DAT
`),
  },
];
