import { stepMicro } from "../machines/classic/micro";
import type { EngineEvent, MicroStep } from "./events";
import type { MachineState } from "./types";

export type Granularity = "micro" | "instruction";

export interface StepOptions {
  /** "micro" runs one register transfer; "instruction" finishes the current instruction. */
  readonly granularity?: Granularity;
}

export interface StepResult {
  readonly state: MachineState;
  /** Every event, in order. */
  readonly events: readonly EngineEvent[];
  /** The micro-steps performed, each with its own events. */
  readonly steps: readonly MicroStep[];
}

/** `step(state, options) -> { state, events }`: the one way the machine moves forward. */
export function step(state: MachineState, options: StepOptions = {}): StepResult {
  const granularity = options.granularity ?? "instruction";
  const steps: MicroStep[] = [];
  let current = state;
  do {
    const result = stepMicro(current);
    if (result.step) steps.push(result.step);
    if (result.state === current) break; // halted, errored or waiting for input
    current = result.state;
  } while (granularity === "instruction" && current.stage !== 0 && current.status === "ready");
  return { state: current, events: steps.flatMap((s) => s.events), steps };
}
