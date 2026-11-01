import type { CacheConfig, DialectId, KeyPress, Schedule } from "@joes-sim/engine";

/** Concept tags (brief, 7.8). Every tag is covered by at least one challenge. */
export const CONCEPTS = [
  "input-output",
  "arithmetic",
  "branching",
  "loops",
  "negative-numbers",
  "arrays",
  "subroutines",
  "characters",
  "debugging",
  // The extended machine.
  "stack",
  "addressing-modes",
  "interrupts",
  "devices",
  // Phase 7.
  "pipelining",
  "caches",
  // Phase 8.
  "concurrency",
] as const;
export type Concept = (typeof CONCEPTS)[number];

export const CONCEPT_NAMES: Record<Concept, string> = {
  "input-output": "Input and output",
  arithmetic: "Arithmetic",
  branching: "Branching",
  loops: "Loops",
  "negative-numbers": "Negative numbers",
  arrays: "Arrays (self-modifying code)",
  subroutines: "Subroutines",
  characters: "Characters",
  debugging: "Bug hunts",
  stack: "The stack",
  "addressing-modes": "Indirect and indexed addressing",
  interrupts: "Interrupts",
  devices: "Devices",
  pipelining: "Pipelining",
  caches: "Caches",
  concurrency: "Cores, races and locks",
};

/** A number is an OUT value; a one-character string is an OTC character. */
export type ExpectedOutput = number | string;

export interface ChallengeTest {
  readonly inputs: readonly number[];
  readonly outputs: readonly ExpectedOutput[];
  /** Extended machine: keys pressed during the run. */
  readonly keys?: readonly KeyPress[];
  /** Extended machine: what the console must show at the end. */
  readonly console?: string;
  /** Extended machine: the lit pixels at the end, as [pixel, colour], in pixel order. */
  readonly pixels?: readonly (readonly [number, number])[];
  /** Multicore machine: how the cores are scheduled for this test. */
  readonly schedule?: Schedule;
  /** The value each labelled mailbox must hold at the end. */
  readonly mailboxes?: Readonly<Record<string, number>>;
}

export interface Targets {
  /** Instruction mailboxes in the program. */
  readonly instructions: number;
  /** Instructions executed, on the test that takes longest. */
  readonly cycles: number;
  /** Mailboxes filled, instructions and data together. */
  readonly mailboxes: number;
}

export interface Challenge {
  readonly id: string;
  readonly title: string;
  /** 1 (first steps) to 5 (hard). */
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
  readonly concepts: readonly Concept[];
  readonly dialect: DialectId;
  /** Present for challenges on the extended or multicore machine. */
  readonly machine?: "extended" | "multicore";
  /**
   * Multicore challenges: how many cores. With `chooseOrder`, the program is fixed and the learner
   * types the order in which the cores run (a manual schedule).
   */
  readonly multicore?: {
    readonly cores: number;
    readonly chooseOrder?: { readonly solution: readonly number[] };
  };
  /** "build" starts from almost nothing; "bug-hunt" gives a broken program to fix. */
  readonly kind: "build" | "bug-hunt";
  readonly description: string;
  readonly starter: string;
  readonly tests: readonly ChallengeTest[];
  readonly targets: Targets;
  /** Nudge, pointer, then the exact cause, shown one at a time. */
  readonly hints: readonly [string, string, string];
  /** A model solution, shown after a genuine attempt. */
  readonly solution: string;
  /** Also run on the pipeline, with at most this many stall cycles on every test. */
  readonly pipeline?: {
    readonly forwarding: boolean;
    readonly prediction: boolean;
    readonly maxStalls: number;
  };
  /**
   * The program is fixed: the learner chooses a cache. Every test must reach the hit rate with a
   * cache of at most `maxMailboxes`.
   */
  readonly cache?: {
    readonly minHitRate: number;
    readonly maxMailboxes: number;
    /** The cache the learner starts from, and one that meets the goal. */
    readonly start: CacheConfig;
    readonly solution: CacheConfig;
  };
}
