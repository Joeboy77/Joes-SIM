/// <reference lib="webworker" />
// Runs the engine off the main thread, so instant runs and look-ahead never freeze the page.
import { run, type MachineState, type RunCondition, type RunOptions } from "@joes-sim/engine";

export interface RunRequest {
  readonly id: number;
  readonly state: MachineState;
  readonly options: {
    readonly maxSteps?: number;
    readonly breakpoints?: number[];
    readonly detectLoops?: boolean;
    readonly conditions?: readonly RunCondition[];
  };
}

self.onmessage = (event: MessageEvent<RunRequest>) => {
  const { id, state, options } = event.data;
  const result = run(state, options as RunOptions);
  self.postMessage({ id, result });
};
