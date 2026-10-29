import type { CreateStateOptions } from "./state";
import type { RunOptions, RunResult } from "./run";
import type { StepOptions, StepResult } from "./step";
import type { MachineState } from "./types";

/**
 * The interface every machine implements (classic now; extended, pipeline, cache, multicore and
 * RISC-V later), so the interface can show any of them.
 */
export interface Machine<State = MachineState> {
  readonly id: string;
  readonly name: string;
  createState(options?: CreateStateOptions): State;
  step(state: State, options?: StepOptions): StepResult;
  run(state: State, options?: RunOptions): RunResult;
  provideInput(state: State, value: number): State;
}
