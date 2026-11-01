/** The multicore machine's state (docs/specs/multicore.md). Plain data, never mutated. */

export type CoreStatus = "ready" | "waiting-input" | "halted" | "error";

/** One core's own registers. Memory and the trays are shared. */
export interface CoreState {
  readonly pc: number;
  readonly mar: number;
  readonly mdr: number;
  readonly ir: number;
  readonly acc: number;
  readonly negative: boolean;
  readonly stage: number;
  readonly currentAddress: number;
  readonly status: CoreStatus;
  /** Instructions this core has completed. */
  readonly cycles: number;
  /** The second mailbox of TAS. */
  readonly operand: number;
}

export type ScheduleMode = "round-robin" | "random" | "manual";

export interface Schedule {
  readonly mode: ScheduleMode;
  /** Round-robin: instructions each core runs before the next one's turn (1 to 10). */
  readonly quantum: number;
  /** Random: the seed. The same seed always gives the same interleaving. */
  readonly seed: number;
}

export const DEFAULT_SCHEDULE: Schedule = { mode: "round-robin", quantum: 1, seed: 1 };

export interface MulticoreState {
  readonly cores: readonly CoreState[];
  readonly schedule: Schedule;
  /** Random: the generator's state. */
  readonly rng: number;
  /** Round-robin: whose turn it is, and how many instructions they have run in it. */
  readonly turn: number;
  readonly used: number;
  /** The core chosen for each step so far (manual); the run replays them. */
  readonly choices: readonly number[];
  /** Manual: the core to run when no choice is recorded for the next step. */
  readonly selected: number;
  /** A core part-way through an instruction, which must finish it before another runs. */
  readonly active: number | null;
  /** The core that ran the last step. */
  readonly last: number | null;
}
