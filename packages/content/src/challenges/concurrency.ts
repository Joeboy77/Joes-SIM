/**
 * Multicore challenges (Phase 8): races and locks. Original to Joe's SIM, CC BY 4.0. Targets are
 * the model solutions' own scores.
 */
import type { Schedule } from "@joes-sim/engine";
import type { Challenge } from "./types";

const lmc = (s: string) => s.replace(/^\n/, "");

const LOST_UPDATE = lmc(`
// Kofi (core 0) and Kwame (core 1) each add 1 to total.
        LDA total
        ADD one
        STA total
        HLT
core1   LDA total
        ADD one
        STA total
        HLT
total   DAT 0
one     DAT 1
`);

const counter = (lock: boolean) => {
  const body = (n: 0 | 1, start: string) =>
    lock
      ? `${start}TAS lock        // wait until the lock is free, and take it
        BRZ in${n}
        BRA ${n === 0 ? "loop0" : "core1"}
in${n}     LDA total
        ADD one
        STA total
        LDA zero
        STA lock        // give the lock back
        LDA n${n}
        SUB one
        STA n${n}
        BRZ done${n}
        BRA ${n === 0 ? "loop0" : "core1"}
done${n}   HLT`
      : `${start}LDA total
        ADD one
        STA total
        LDA n${n}
        SUB one
        STA n${n}
        BRZ done${n}
        BRA ${n === 0 ? "loop0" : "core1"}
done${n}   HLT`;
  return lmc(`
// Kofi and Kwame each add 1 to total three times.
${body(0, "loop0   ")}
${body(1, "core1   ")}
total   DAT 0
one     DAT 1
n0      DAT 3
n1      DAT 3
${lock ? "zero    DAT 0\nlock    DAT 0\n" : ""}`);
};

const SCHEDULES: readonly Schedule[] = [
  { mode: "round-robin", quantum: 1, seed: 1 },
  { mode: "round-robin", quantum: 2, seed: 1 },
  { mode: "round-robin", quantum: 4, seed: 1 },
  ...[1, 2, 3, 4, 5].map((seed) => ({ mode: "random" as const, quantum: 1, seed })),
];

export const CONCURRENCY_CHALLENGES: readonly Challenge[] = [
  {
    id: "lost-update",
    title: "Find the order that loses an update",
    difficulty: 3,
    concepts: ["concurrency"],
    dialect: "classic",
    machine: "multicore",
    multicore: { cores: 2, chooseOrder: { solution: [0, 1, 0, 1, 0, 1, 0, 1] } },
    kind: "build",
    description:
      "Two cores each add 1 to total, so it should end as 2. Do not change the program: choose the order the cores run in (0 for Kofi, 1 for Kwame) so that total ends as 1.",
    starter: LOST_UPDATE,
    tests: [{ inputs: [], outputs: [], mailboxes: { total: 1 } }],
    targets: { instructions: 8, cycles: 8, mailboxes: 10 },
    hints: [
      "Each addition is three steps: LDA, ADD, STA. What if the other core runs in the middle?",
      "If both cores LDA total before either does STA, both add 1 to the same old value.",
      "Try 0 1 0 1 0 1 0 1: Kofi and Kwame take turns, one instruction each.",
    ],
    solution: LOST_UPDATE,
  },
  {
    id: "lock-the-counter",
    title: "Fix this counter with a lock",
    difficulty: 4,
    concepts: ["concurrency", "debugging"],
    dialect: "classic",
    machine: "multicore",
    multicore: { cores: 2 },
    kind: "bug-hunt",
    description:
      "Kofi and Kwame each add 1 to total three times, so it should end as 6. With some orders of steps it ends lower. Use TAS to build a lock so total is 6 under every schedule tested.",
    starter: counter(false),
    tests: SCHEDULES.map((schedule) => ({
      inputs: [],
      outputs: [],
      schedule,
      mailboxes: { total: 6 },
    })),
    targets: { instructions: 28, cycles: 102, mailboxes: 36 },
    hints: [
      "Which instructions must run without the other core getting in between?",
      "LDA total, ADD one, STA total is the critical section. Only one core at a time may be in it.",
      "Before it: TAS lock, then BRZ into the section, else BRA back to TAS. After it: LDA zero, STA lock.",
    ],
    solution: counter(true),
  },
];
