/**
 * Pipeline and cache challenges (Phase 7). Original to Joe's SIM, CC BY 4.0. Targets are the model
 * solutions' own scores.
 */
import type { Challenge } from "./types";

const lmc = (s: string) => s.replace(/^\n/, "");

const TABLE_SUM = lmc(`
loop    LDA total
        ADD t,X         // the next number in the table
        STA total
        INX
        STX i
        LDA i
        SUB n
        BRZ done
        BRA loop
done    LDA total
        OUT
        HLT
total   DAT 0
i       DAT 0
n       DAT 8
t       DAT 3
        DAT 1
        DAT 4
        DAT 1
        DAT 5
        DAT 9
        DAT 2
        DAT 6
`);

export const PERFORMANCE_CHALLENGES: readonly Challenge[] = [
  {
    id: "no-stalls",
    title: "Reorder to remove the stall",
    difficulty: 3,
    concepts: ["pipelining", "addressing-modes"],
    dialect: "classic",
    machine: "extended",
    kind: "build",
    description:
      "This program works, but on the pipeline (with forwarding) it stalls for one cycle. Reorder its instructions so it gives the same outputs with no stalls at all. Open the Pipeline view to see where it waits.",
    starter: lmc(`
        INP
        STA i
        LDA one
        LDX i
        ADD t,X
        OUT
        HLT
i       DAT
one     DAT 1
t       DAT 10
        DAT 20
        DAT 30
`),
    tests: [
      { inputs: [0], outputs: [11] },
      { inputs: [2], outputs: [31] },
    ],
    pipeline: { forwarding: true, prediction: false, maxStalls: 0 },
    targets: { instructions: 7, cycles: 7, mailboxes: 14 },
    hints: [
      "In the pipeline view, which instruction is stalled, and what is it waiting for?",
      "ADD t,X needs X in EX, but LDX only has it at the end of MEM, the cycle before.",
      "Load X earlier: put LDX i straight after STA i, before LDA one. Then LDA one fills the gap.",
    ],
    solution: lmc(`
        INP
        STA i
        LDX i           // X is ready by the time ADD needs it
        LDA one
        ADD t,X
        OUT
        HLT
i       DAT
one     DAT 1
t       DAT 10
        DAT 20
        DAT 30
`),
  },
  {
    id: "pick-a-cache",
    title: "Choose a cache that hits 80%",
    difficulty: 3,
    concepts: ["caches"],
    dialect: "classic",
    machine: "extended",
    kind: "build",
    description:
      "This program adds up a table. Do not change it: change the cache instead. Find a cache of at most 8 mailboxes that gets at least 80% of its data accesses as hits.",
    starter: TABLE_SUM,
    tests: [{ inputs: [], outputs: [31] }],
    cache: {
      minHitRate: 0.8,
      maxMailboxes: 8,
      start: { blockSize: 1, sets: 4, ways: 1, replacement: "lru", write: "write-back" },
      solution: { blockSize: 2, sets: 2, ways: 2, replacement: "lru", write: "write-back" },
    },
    targets: { instructions: 12, cycles: 74, mailboxes: 25 },
    hints: [
      "Which mailboxes does the loop use over and over? Which does it use only once?",
      "total, i and n are used every time round. Bigger blocks bring in neighbours; more ways stop blocks that share a set from throwing each other out.",
      "Try 2-mailbox blocks, 2 sets and 2 ways, with LRU: 8 mailboxes, and above 85% hits.",
    ],
    solution: TABLE_SUM,
  },
];
