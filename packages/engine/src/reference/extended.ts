/**
 * Reference programs for the extended machine (docs/specs/extended.md). Each runs in every
 * dialect; the expected results are written out by hand.
 */
import type { StopReason } from "../core/run";
import type { MachineState } from "../core/types";
import { numberSegments } from "../machines/extended/devices";
import type { KeyPress } from "../machines/extended/types";

export interface ExtendedCase {
  readonly inputs: readonly number[];
  readonly keys?: readonly KeyPress[];
  readonly outputs?: readonly number[];
  /** How the run ends. Default "halted". */
  readonly reason?: StopReason;
  /** Instructions to run before stopping with "budget". */
  readonly maxSteps?: number;
  /** Checks on the final state: devices, registers. */
  readonly check?: (state: MachineState) => boolean;
}

export interface ExtendedProgram {
  readonly id: string;
  readonly title: string;
  readonly concepts: readonly string[];
  readonly source: string;
  readonly cases: readonly ExtendedCase[];
}

const program = (p: ExtendedProgram) => ({ ...p, source: p.source.replace(/^\n/, "") });

export const EXTENDED_REFERENCE_PROGRAMS: readonly ExtendedProgram[] = [
  program({
    id: "recursive-sum",
    title: "Add 1 to n with a recursive subroutine",
    concepts: ["subroutines", "stack", "recursion"],
    source: `
        INP
        CALL sum
        OUT
        HLT
// sum(n) = n + sum(n - 1), and sum(0) = 0. n arrives in ACC; the answer leaves in ACC.
sum     BRZ base
        PUSH            // keep n while working out sum(n - 1)
        SUB one
        CALL sum
        STA part
        POP             // n again
        ADD part
        RET
base    RET
one     DAT 1
part    DAT
`,
    cases: [
      { inputs: [4], outputs: [10], check: (s) => s.ext?.sp === 100 },
      { inputs: [0], outputs: [0] },
      { inputs: [10], outputs: [55] },
    ],
  }),
  program({
    id: "array-sum-indexed",
    title: "Sum a table with indexed addressing",
    concepts: ["indexed-addressing", "arrays"],
    source: `
loop    LDA total
        ADD table,X     // the value at table + X
        STA total
        INX
        STX i
        LDA i
        SUB size
        BRZ done
        BRA loop
done    LDA total
        OUT
        HLT
total   DAT 0
i       DAT 0
size    DAT 5
table   DAT 3
        DAT 1
        DAT 4
        DAT 1
        DAT 5
`,
    cases: [{ inputs: [], outputs: [14], check: (s) => s.ext?.x === 5 }],
  }),
  program({
    id: "array-sum-indirect",
    title: "Sum a table by walking a pointer",
    concepts: ["indirect-addressing", "arrays"],
    source: `
loop    LDA total
        ADD @ptr        // the value at the address in ptr
        STA total
        LDA ptr
        ADD one
        STA ptr
        SUB end
        BRZ done
        BRA loop
done    LDA total
        OUT
        HLT
total   DAT 0
one     DAT 1
ptr     DAT table
end     DAT stop
table   DAT 2
        DAT 7
        DAT 1
stop    DAT 0
`,
    cases: [{ inputs: [], outputs: [10] }],
  }),
  program({
    id: "timer-counter",
    title: "Count timer interrupts on the seven-segment display",
    concepts: ["interrupts", "timer", "devices"],
    source: `
        VEC tick
        LDA period
        PUT 20          // a timer interrupt every 10 instructions
        EI
idle    WAIT
        BRA idle
tick    LDA count
        ADD one
        STA count
        PUT 30          // show the count
        SUB five
        BRZ done
        RTI
done    LDA count
        OUT
        HLT
period  DAT 10
count   DAT 0
one     DAT 1
five    DAT 5
`,
    cases: [
      {
        inputs: [],
        outputs: [5],
        check: (s) => JSON.stringify(s.ext?.devices.segments) === JSON.stringify(numberSegments(5)),
      },
    ],
  }),
  program({
    id: "keyboard-echo",
    title: "Echo keys to the console until Enter",
    concepts: ["interrupts", "keyboard", "devices"],
    source: `
        VEC key
        EI
idle    WAIT
        BRA idle
key     GET 3           // how many keys are waiting?
        BRZ back
        GET 2           // the next key
        STA ch
        SUB enter
        BRZ done
        LDA ch
        PUT 1           // show it on the console
        BRA key
back    RTI
done    HLT
ch      DAT
enter   DAT 10
`,
    cases: [
      {
        inputs: [],
        keys: [
          { cycle: 5, key: 72 },
          { cycle: 5, key: 105 },
          { cycle: 40, key: 10 },
        ],
        check: (s) => s.ext?.devices.console === "Hi",
      },
      // With no keys, WAIT waits for one.
      { inputs: [], reason: "waiting-interrupt" },
    ],
  }),
  program({
    id: "moving-dot",
    title: "Move a dot with the timer; change its colour with a key",
    concepts: ["interrupts", "timer", "keyboard", "pixel-display"],
    source: `
        VEC  tick       // interrupts run "tick"
        LDA  period
        PUT  20         // timer every 40 instructions
        EI
idle    WAIT            // nothing to do until an interrupt
        BRA  idle

tick    GET  50         // which device?
        SUB  one
        BRZ  timer      // 1 = timer
        GET  02         // 2 = keyboard: read the key
        SUB  zero       // key '0' is code 48
        STA  colour
        RTI
timer   LDA  pos
        PUT  10         // choose the old pixel
        LDA  black
        PUT  11         // clear it
        LDA  pos
        ADD  one
        SUB  sixteen
        BRP  wrap       // past the end of the row?
        ADD  sixteen
        BRA  draw
wrap    LDA  zeroval
draw    STA  pos
        PUT  10
        LDA  colour
        PUT  11         // draw the dot
        RTI

period  DAT  40
one     DAT  1
zero    DAT  48
sixteen DAT  16
zeroval DAT  0
black   DAT  0
pos     DAT  0
colour  DAT  15
`,
    cases: [
      {
        inputs: [],
        keys: [{ cycle: 200, key: 51 }],
        // 1,010 instructions ends between interrupts, with the dot drawn.
        maxSteps: 1010,
        reason: "budget",
        check: (s) => {
          const lit = (s.ext?.devices.pixels ?? []).flatMap((c, i) => (c ? [[i, c]] : []));
          // One dot, at the ninth pixel of the top row, in colour 3 after the key '3'.
          return JSON.stringify(lit) === JSON.stringify([[8, 3]]);
        },
      },
    ],
  }),
];
