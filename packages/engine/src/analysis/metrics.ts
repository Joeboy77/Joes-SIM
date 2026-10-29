import type { Program } from "../assembler/types";
import type { MachineState } from "../core/types";

export interface ProgramMetrics {
  /** Instruction mailboxes in the program. */
  readonly instructions: number;
  /** DAT mailboxes in the program. */
  readonly data: number;
  /** All mailboxes the program fills. */
  readonly mailboxes: number;
}

export interface RunMetrics extends ProgramMetrics {
  /** Instructions executed (fetch, decode, execute cycles). */
  readonly cycles: number;
  readonly microSteps: number;
}

export function measure(program: Program): ProgramMetrics {
  const instructions = program.kinds.filter((k) => k === "code").length;
  const data = program.kinds.filter((k) => k === "data").length;
  return { instructions, data, mailboxes: instructions + data };
}

export function measureRun(program: Program, state: MachineState): RunMetrics {
  return { ...measure(program), cycles: state.cycles, microSteps: state.microSteps };
}
