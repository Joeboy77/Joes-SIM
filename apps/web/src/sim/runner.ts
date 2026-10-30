import { run, type MachineState, type RunResult } from "@joes-sim/engine";
import type { RunRequest } from "./engine.worker";

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (r: RunResult) => void; state: MachineState; options: RunRequest["options"] }
>();

function getWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === "undefined") return null;
  try {
    worker = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; result: RunResult }>) => {
      pending.get(e.data.id)?.resolve(e.data.result);
      pending.delete(e.data.id);
    };
    // If the worker fails, finish any waiting runs here so the simulator is never left busy.
    worker.onerror = () => {
      worker = null;
      for (const [id, p] of pending) {
        pending.delete(id);
        p.resolve(run(p.state, p.options));
      }
    };
    return worker;
  } catch {
    return null;
  }
}

/** Runs in a web worker when one is available, otherwise on the main thread. */
export function runOffThread(
  state: MachineState,
  options: RunRequest["options"] = {},
): Promise<RunResult> {
  const w = getWorker();
  if (!w) return Promise.resolve(run(state, options));
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, { resolve, state, options });
    w.postMessage({ id, state, options } satisfies RunRequest);
  });
}
