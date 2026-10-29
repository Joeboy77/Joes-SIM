/**
 * Reference programs. Every program runs against every dialect it supports, and the expected
 * results are written out by hand, so differences between dialects are documented right here.
 *
 * Outputs: numbers are OUT values; strings are OTC characters.
 */
import type { DiagnosticCode } from "../assembler/types";
import type { StopReason } from "../core/run";
import type { DialectId } from "../dialects/types";

export type ExpectedOutput = number | string;

export interface Expectation {
  readonly outputs?: readonly ExpectedOutput[];
  /** How the run ends. Default "halted". */
  readonly reason?: StopReason;
}

export interface ReferenceCase extends Expectation {
  readonly inputs: readonly number[];
  /** Only run this case in these dialects (for example negative inputs). */
  readonly only?: readonly DialectId[];
  /** Results that differ from the default in some dialects. */
  readonly byDialect?: Partial<Record<DialectId, Expectation>>;
}

export interface ReferenceProgram {
  readonly id: string;
  readonly title: string;
  readonly concepts: readonly string[];
  readonly source: string;
  /** Dialects where assembly must fail, with the expected error. */
  readonly assemblyError?: {
    readonly dialects: readonly DialectId[];
    readonly code: DiagnosticCode;
  };
  readonly cases: readonly ReferenceCase[];
}

const SIGNED: DialectId[] = ["higginson", "ocr"];

const program = (p: ReferenceProgram) => ({ ...p, source: p.source.replace(/^\n/, "") });

export const REFERENCE_PROGRAMS: readonly ReferenceProgram[] = [
  program({
    id: "add",
    title: "Add two numbers",
    concepts: ["input-output", "arithmetic"],
    source: `
        INP
        STA first
        INP
        ADD first
        OUT
        HLT
first   DAT
`,
    cases: [
      { inputs: [3, 4], outputs: [7] },
      { inputs: [0, 0], outputs: [0] },
      // 1100 does not fit: every dialect drops the thousands digit.
      { inputs: [500, 600], outputs: [100] },
      { inputs: [-5, 3], outputs: [-2], only: SIGNED },
    ],
  }),
  program({
    id: "subtract",
    title: "Subtract the second number from the first",
    concepts: ["input-output", "arithmetic", "negative-numbers"],
    source: `
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
`,
    cases: [
      { inputs: [9, 4], outputs: [5] },
      { inputs: [7, 7], outputs: [0] },
      // Classic keeps three unsigned digits: 4 - 9 leaves 995 with the negative flag set.
      { inputs: [4, 9], outputs: [-5], byDialect: { classic: { outputs: [995] } } },
    ],
  }),
  program({
    id: "echo",
    title: "Echo one input",
    concepts: ["input-output"],
    source: `
        INP
        OUT
        HLT
`,
    cases: [
      { inputs: [42], outputs: [42] },
      { inputs: [999], outputs: [999] },
      { inputs: [-999], outputs: [-999], only: SIGNED },
    ],
  }),
  program({
    id: "echo-until-zero",
    title: "Echo inputs until a zero",
    concepts: ["input-output", "loops"],
    source: `
loop    INP
        BRZ done
        OUT
        BRA loop
done    HLT
`,
    cases: [
      { inputs: [5, 7, 0], outputs: [5, 7] },
      { inputs: [0], outputs: [] },
      { inputs: [-3, 4, 0], outputs: [-3, 4], only: SIGNED },
      { inputs: [5], outputs: [5], reason: "waiting-input" },
    ],
  }),
  program({
    id: "countdown",
    title: "Count down to zero",
    concepts: ["loops", "branching"],
    source: `
        INP
loop    OUT
        SUB one
        BRP loop
        HLT
one     DAT 1
`,
    cases: [
      { inputs: [3], outputs: [3, 2, 1, 0] },
      { inputs: [0], outputs: [0] },
    ],
  }),
  program({
    id: "count-up",
    title: "Count up from 1 to n",
    concepts: ["loops", "branching"],
    source: `
        INP
        STA n
loop    LDA count
        ADD one
        STA count
        OUT
        LDA n
        SUB count
        BRZ done
        BRA loop
done    HLT
n       DAT
count   DAT 0
one     DAT 1
`,
    cases: [
      { inputs: [3], outputs: [1, 2, 3] },
      { inputs: [1], outputs: [1] },
    ],
  }),
  program({
    id: "multiply",
    title: "Multiply by repeated addition",
    concepts: ["loops", "arithmetic"],
    source: `
        INP
        STA a
        INP
        STA b
loop    LDA b
        BRZ done
        SUB one
        STA b
        LDA result
        ADD a
        STA result
        BRA loop
done    LDA result
        OUT
        HLT
a       DAT
b       DAT
result  DAT 0
one     DAT 1
`,
    cases: [
      { inputs: [6, 7], outputs: [42] },
      { inputs: [5, 0], outputs: [0] },
      { inputs: [0, 9], outputs: [0] },
      { inputs: [12, 12], outputs: [144] },
    ],
  }),
  program({
    id: "divide",
    title: "Divide: quotient and remainder",
    concepts: ["loops", "arithmetic", "branching"],
    source: `
        INP
        STA a
        INP
        STA b
loop    LDA a
        SUB b
        BRP keep
        BRA done
keep    STA a
        LDA q
        ADD one
        STA q
        BRA loop
done    LDA q
        OUT
        LDA a
        OUT
        HLT
a       DAT
b       DAT
q       DAT 0
one     DAT 1
`,
    cases: [
      { inputs: [17, 5], outputs: [3, 2] },
      { inputs: [20, 4], outputs: [5, 0] },
      { inputs: [3, 7], outputs: [0, 3] },
      // Dividing by zero never finishes: the state eventually repeats.
      { inputs: [5, 0], outputs: [], reason: "infinite-loop" },
    ],
  }),
  program({
    id: "max-of-two",
    title: "Larger of two numbers",
    concepts: ["branching"],
    source: `
        INP
        STA a
        INP
        STA b
        SUB a
        BRP bbig
        LDA a
        BRA print
bbig    LDA b
print   OUT
        HLT
a       DAT
b       DAT
`,
    cases: [
      { inputs: [3, 8], outputs: [8] },
      { inputs: [8, 3], outputs: [8] },
      { inputs: [5, 5], outputs: [5] },
      { inputs: [-4, -9], outputs: [-4], only: SIGNED },
    ],
  }),
  program({
    id: "min-of-two",
    title: "Smaller of two numbers",
    concepts: ["branching"],
    source: `
        INP
        STA a
        INP
        STA b
        SUB a
        BRP abig
        LDA b
        BRA print
abig    LDA a
print   OUT
        HLT
a       DAT
b       DAT
`,
    cases: [
      { inputs: [3, 8], outputs: [3] },
      { inputs: [8, 3], outputs: [3] },
      { inputs: [6, 6], outputs: [6] },
    ],
  }),
  program({
    id: "max-of-three",
    title: "Largest of three numbers",
    concepts: ["branching"],
    source: `
        INP
        STA max
        INP
        STA x
        SUB max
        BRP new1
        BRA next
new1    LDA x
        STA max
next    INP
        STA x
        SUB max
        BRP new2
        BRA print
new2    LDA x
        STA max
print   LDA max
        OUT
        HLT
max     DAT
x       DAT
`,
    cases: [
      { inputs: [4, 9, 2], outputs: [9] },
      { inputs: [9, 4, 2], outputs: [9] },
      { inputs: [1, 2, 3], outputs: [3] },
    ],
  }),
  program({
    id: "sum-n",
    title: "Sum of n inputs",
    concepts: ["loops", "input-output"],
    source: `
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
`,
    cases: [
      { inputs: [3, 10, 20, 30], outputs: [60] },
      { inputs: [0], outputs: [0] },
      { inputs: [2, 5], outputs: [], reason: "waiting-input" },
    ],
  }),
  program({
    id: "sum-until-zero",
    title: "Sum inputs until a zero",
    concepts: ["loops", "input-output"],
    source: `
loop    INP
        BRZ done
        ADD total
        STA total
        BRA loop
done    LDA total
        OUT
        HLT
total   DAT 0
`,
    cases: [
      { inputs: [1, 2, 3, 0], outputs: [6] },
      { inputs: [0], outputs: [0] },
    ],
  }),
  program({
    id: "absolute-difference",
    title: "Difference between two numbers",
    concepts: ["branching", "negative-numbers"],
    source: `
        INP
        STA a
        INP
        STA b
        LDA a
        SUB b
        BRP print
        LDA b
        SUB a
print   OUT
        HLT
a       DAT
b       DAT
`,
    cases: [
      { inputs: [9, 4], outputs: [5] },
      { inputs: [4, 9], outputs: [5] },
      { inputs: [6, 6], outputs: [0] },
    ],
  }),
  program({
    id: "odd-or-even",
    title: "Odd (1) or even (0)",
    concepts: ["loops", "arithmetic", "negative-numbers"],
    source: `
        INP
loop    SUB two
        BRP loop
        ADD two
        OUT
        HLT
two     DAT 2
`,
    // Classic reaches 998 or 999 with the flag set; adding 2 wraps to 0 or 1. Signed dialects
    // reach -2 or -1. Both give the same answer.
    cases: [
      { inputs: [5], outputs: [1] },
      { inputs: [4], outputs: [0] },
      { inputs: [0], outputs: [0] },
      { inputs: [1], outputs: [1] },
    ],
  }),
  program({
    id: "square",
    title: "Square a number",
    concepts: ["loops", "arithmetic"],
    source: `
        INP
        STA n
        STA count
loop    LDA count
        BRZ done
        SUB one
        STA count
        LDA result
        ADD n
        STA result
        BRA loop
done    LDA result
        OUT
        HLT
n       DAT
count   DAT
result  DAT 0
one     DAT 1
`,
    cases: [
      { inputs: [7], outputs: [49] },
      { inputs: [0], outputs: [0] },
      { inputs: [31], outputs: [961] },
    ],
  }),
  program({
    id: "power",
    title: "Raise a number to a power",
    concepts: ["loops", "nested-loops", "arithmetic"],
    source: `
        INP
        STA base
        INP
        STA exp
        LDA one
        STA result
outer   LDA exp
        BRZ done
        SUB one
        STA exp
        LDA zero
        STA prod
        LDA base
        STA count
inner   LDA count
        BRZ next
        SUB one
        STA count
        LDA prod
        ADD result
        STA prod
        BRA inner
next    LDA prod
        STA result
        BRA outer
done    LDA result
        OUT
        HLT
base    DAT
exp     DAT
result  DAT
prod    DAT
count   DAT
one     DAT 1
zero    DAT 0
`,
    cases: [
      { inputs: [2, 5], outputs: [32] },
      { inputs: [3, 0], outputs: [1] },
      { inputs: [5, 4], outputs: [625] },
      { inputs: [10, 2], outputs: [100] },
    ],
  }),
  program({
    id: "factorial",
    title: "Factorial",
    concepts: ["loops", "nested-loops", "arithmetic"],
    source: `
        INP
        STA n
        LDA one
        STA result
outer   LDA n
        BRZ done
        STA count
        LDA zero
        STA prod
inner   LDA count
        BRZ next
        SUB one
        STA count
        LDA prod
        ADD result
        STA prod
        BRA inner
next    LDA prod
        STA result
        LDA n
        SUB one
        STA n
        BRA outer
done    LDA result
        OUT
        HLT
n       DAT
result  DAT
count   DAT
prod    DAT
one     DAT 1
zero    DAT 0
`,
    cases: [
      { inputs: [5], outputs: [120] },
      { inputs: [0], outputs: [1] },
      { inputs: [1], outputs: [1] },
      { inputs: [6], outputs: [720] },
    ],
  }),
  program({
    id: "fibonacci",
    title: "First n Fibonacci numbers",
    concepts: ["loops"],
    source: `
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
a       DAT 0
b       DAT 1
next    DAT
one     DAT 1
`,
    cases: [
      { inputs: [7], outputs: [0, 1, 1, 2, 3, 5, 8] },
      { inputs: [1], outputs: [0] },
      { inputs: [0], outputs: [] },
    ],
  }),
  program({
    id: "sort-two",
    title: "Sort two numbers",
    concepts: ["branching"],
    source: `
        INP
        STA a
        INP
        STA b
        SUB a
        BRP inorder
        LDA b
        OUT
        LDA a
        OUT
        HLT
inorder LDA a
        OUT
        LDA b
        OUT
        HLT
a       DAT
b       DAT
`,
    cases: [
      { inputs: [8, 3], outputs: [3, 8] },
      { inputs: [3, 8], outputs: [3, 8] },
      { inputs: [4, 4], outputs: [4, 4] },
    ],
  }),
  program({
    id: "sort-three",
    title: "Sort three numbers",
    concepts: ["branching"],
    source: `
        INP
        STA a
        INP
        STA b
        INP
        STA c
// Swap a and b if they are out of order.
        LDA b
        SUB a
        BRP s2
        LDA a
        STA t
        LDA b
        STA a
        LDA t
        STA b
s2      LDA c       // then b and c
        SUB b
        BRP s3
        LDA b
        STA t
        LDA c
        STA b
        LDA t
        STA c
s3      LDA b       ; then a and b again
        SUB a
        BRP print
        LDA a
        STA t
        LDA b
        STA a
        LDA t
        STA b
print   LDA a       # output in order
        OUT
        LDA b
        OUT
        LDA c
        OUT
        HLT
a       DAT
b       DAT
c       DAT
t       DAT
`,
    cases: [
      { inputs: [3, 1, 2], outputs: [1, 2, 3] },
      { inputs: [9, 5, 1], outputs: [1, 5, 9] },
      { inputs: [1, 2, 3], outputs: [1, 2, 3] },
      { inputs: [2, 2, 1], outputs: [1, 2, 2] },
    ],
  }),
  program({
    id: "array-sum",
    title: "Sum a table (self-modifying code)",
    concepts: ["arrays", "self-modifying-code", "loops"],
    source: `
loop    LDA count
        BRZ done
        SUB one
        STA count
load    LDA table
        ADD total
        STA total
        LDA load
        ADD one
        STA load
        BRA loop
done    LDA total
        OUT
        HLT
count   DAT 5
total   DAT 0
one     DAT 1
table   DAT 3
        DAT 1
        DAT 4
        DAT 1
        DAT 5
`,
    cases: [{ inputs: [], outputs: [14] }],
  }),
  program({
    id: "array-max",
    title: "Largest value in a table (self-modifying code)",
    concepts: ["arrays", "self-modifying-code", "loops"],
    source: `
        LDA table
        STA max
loop    LDA count
        BRZ done
        SUB one
        STA count
        LDA ptr
        ADD one
        STA ptr
ptr     LDA table
        STA x
        SUB max
        BRP newmax
        BRA loop
newmax  LDA x
        STA max
        BRA loop
done    LDA max
        OUT
        HLT
count   DAT 4
max     DAT
x       DAT
one     DAT 1
table   DAT 7
        DAT 3
        DAT 12
        DAT 9
        DAT 5
`,
    cases: [{ inputs: [], outputs: [12] }],
  }),
  program({
    id: "reverse",
    title: "Read n numbers and print them backwards",
    concepts: ["arrays", "self-modifying-code", "loops"],
    source: `
        INP
        STA n
        STA count
read    LDA count
        BRZ write
        SUB one
        STA count
        INP
store   STA array
        LDA store
        ADD one
        STA store
        BRA read
write   LDA n
        BRZ done
        SUB one
        STA n
        LDA store
        SUB one
        STA store
        ADD k200
        STA fetch
fetch   LDA array
        OUT
        BRA write
done    HLT
n       DAT
count   DAT
one     DAT 1
k200    DAT 200
array   DAT
`,
    cases: [
      { inputs: [3, 10, 20, 30], outputs: [30, 20, 10] },
      { inputs: [1, 7], outputs: [7] },
      { inputs: [0], outputs: [] },
    ],
  }),
  program({
    id: "bubble-sort",
    title: "Bubble sort a table (self-modifying code)",
    concepts: ["arrays", "self-modifying-code", "nested-loops"],
    source: `
pass    LDA zero
        STA swapped
        STA i
inner   LDA i
        SUB last
        BRP endpass
        LDA ldai
        ADD i
        STA geta
        ADD one
        STA getb
        LDA stai
        ADD i
        STA puta
        ADD one
        STA putb
geta    LDA array
        STA x
getb    LDA array
        STA y
        SUB x
        BRP noswap
        LDA y
puta    STA array
        LDA x
putb    STA array
        LDA one
        STA swapped
noswap  LDA i
        ADD one
        STA i
        BRA inner
endpass LDA swapped
        BRZ print
        BRA pass
print   LDA zero
        STA i
ploop   LDA i
        SUB n
        BRP done
        LDA ldai
        ADD i
        STA pget
pget    LDA array
        OUT
        LDA i
        ADD one
        STA i
        BRA ploop
done    HLT
ldai    LDA array
stai    STA array
swapped DAT
i       DAT
x       DAT
y       DAT
zero    DAT 0
one     DAT 1
n       DAT 5
last    DAT 4
array   DAT 5
        DAT 2
        DAT 9
        DAT 1
        DAT 7
`,
    cases: [{ inputs: [], outputs: [1, 2, 5, 7, 9] }],
  }),
  program({
    id: "gcd",
    title: "Greatest common divisor",
    concepts: ["loops", "branching", "arithmetic"],
    source: `
        INP
        STA a
        INP
        STA b
loop    LDA a
        SUB b
        BRZ done
        BRP agt
        LDA b
        SUB a
        STA b
        BRA loop
agt     STA a
        BRA loop
done    LDA a
        OUT
        HLT
a       DAT
b       DAT
`,
    cases: [
      { inputs: [12, 18], outputs: [6] },
      { inputs: [7, 7], outputs: [7] },
      { inputs: [17, 5], outputs: [1] },
      { inputs: [48, 36], outputs: [12] },
    ],
  }),
  program({
    id: "triangular",
    title: "Triangular number 1 + 2 + ... + n",
    concepts: ["loops", "arithmetic"],
    source: `
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
`,
    cases: [
      { inputs: [4], outputs: [10] },
      { inputs: [0], outputs: [0] },
      { inputs: [44], outputs: [990] },
    ],
  }),
  program({
    id: "equal",
    title: "Are two numbers equal? (1 or 0)",
    concepts: ["branching"],
    source: `
        INP
        STA a
        INP
        SUB a
        BRZ same
        LDA zero
        BRA print
same    LDA one
print   OUT
        HLT
a       DAT
zero    DAT 0
one     DAT 1
`,
    cases: [
      { inputs: [5, 5], outputs: [1] },
      { inputs: [5, 6], outputs: [0] },
      { inputs: [6, 5], outputs: [0] },
    ],
  }),
  program({
    id: "overflow",
    title: "Adding past 999",
    concepts: ["arithmetic", "overflow"],
    source: `
        INP
        ADD k
        OUT
        HLT
k       DAT 999
`,
    cases: [
      { inputs: [1], outputs: [0] },
      { inputs: [0], outputs: [999] },
      { inputs: [500], outputs: [499] },
      // -999 + 999: no overflow at all.
      { inputs: [-999], outputs: [0], only: SIGNED },
    ],
  }),
  program({
    id: "sign-test",
    title: "Zero, positive or negative (0, 1, 2)",
    concepts: ["branching", "negative-numbers"],
    source: `
        INP
        STA a
        INP
        STA b
        LDA a
        SUB b
        OUT
        BRZ zero
        BRP pos
        LDA two
        OUT
        HLT
zero    LDA z
        OUT
        HLT
pos     LDA one
        OUT
        HLT
a       DAT
b       DAT
two     DAT 2
z       DAT 0
one     DAT 1
`,
    cases: [
      { inputs: [5, 5], outputs: [0, 0] },
      { inputs: [9, 4], outputs: [5, 1] },
      { inputs: [4, 9], outputs: [-5, 2], byDialect: { classic: { outputs: [995, 2] } } },
    ],
  }),
  program({
    id: "lda-clears-flag",
    title: "LDA clears the negative flag",
    concepts: ["negative-numbers", "branching"],
    source: `
        LDA three
        SUB five
        LDA three
        BRP pos
        LDA zero
        OUT
        HLT
pos     LDA one
        OUT
        HLT
three   DAT 3
five    DAT 5
zero    DAT 0
one     DAT 1
`,
    cases: [{ inputs: [], outputs: [1] }],
  }),
  program({
    id: "add-after-negative",
    title: "Adding back after going negative",
    concepts: ["negative-numbers", "arithmetic"],
    source: `
        LDA three
        SUB five
        ADD five
        BRP pos
        LDA zero
        OUT
        HLT
pos     OUT
        HLT
three   DAT 3
five    DAT 5
zero    DAT 0
`,
    // Classic: 998 + 5 wraps to 3 and clears the flag. Signed: -2 + 5 = 3.
    cases: [{ inputs: [], outputs: [3] }],
  }),
  program({
    id: "hello",
    title: "Say Hi with OTC",
    concepts: ["input-output", "characters"],
    source: `
        LDA h
        OTC
        LDA i
        OTC
        LDA nl
        OTC
        HLT
h       DAT 72
i       DAT 105
nl      DAT 10
`,
    assemblyError: { dialects: ["classic", "ocr"], code: "instruction-not-in-dialect" },
    cases: [{ inputs: [], outputs: ["H", "i", "\n"] }],
  }),
  program({
    id: "times-table",
    title: "First five multiples",
    concepts: ["loops", "arithmetic"],
    source: `
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
`,
    cases: [
      { inputs: [7], outputs: [7, 14, 21, 28, 35] },
      { inputs: [0], outputs: [0, 0, 0, 0, 0] },
    ],
  }),
  program({
    id: "tight-loop",
    title: "A loop with no way out",
    concepts: ["loops", "infinite-loops"],
    source: `
loop    BRA loop
`,
    cases: [{ inputs: [], outputs: [], reason: "infinite-loop" }],
  }),
  program({
    id: "step-by-two",
    title: "Counting down by two can miss zero",
    concepts: ["loops", "infinite-loops", "negative-numbers"],
    source: `
        INP
loop    BRZ done
        SUB two
        BRA loop
done    HLT
two     DAT 2
`,
    cases: [
      { inputs: [4], outputs: [] },
      // Odd numbers step over zero and never stop.
      { inputs: [3], outputs: [], reason: "infinite-loop" },
    ],
  }),
  program({
    id: "invalid-instruction",
    title: "Running a value that is not an instruction",
    concepts: ["machine-code"],
    source: `
        LDA x
        DAT 400
        HLT
x       DAT 5
`,
    cases: [{ inputs: [], outputs: [], reason: "error" }],
  }),
];
