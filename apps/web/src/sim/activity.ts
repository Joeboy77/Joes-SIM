import type { Component, MicroStep } from "@joes-sim/engine";
import type { Direction } from "./store";

export interface Transfer {
  readonly from: Component;
  readonly to: Component;
  readonly value: number;
}

export interface Activity {
  /** Value movements to animate, in order. Reversed when stepping back. */
  readonly transfers: readonly Transfer[];
  readonly active: ReadonlySet<Component>;
  readonly reads: ReadonlySet<number>;
  readonly writes: ReadonlySet<number>;
  readonly branch: {
    readonly from: number;
    readonly target: number;
    readonly taken: boolean;
  } | null;
}

export const NO_ACTIVITY: Activity = {
  transfers: [],
  active: new Set(),
  reads: new Set(),
  writes: new Set(),
  branch: null,
};

/** What the last action did, for highlights and animation. Views never look at the engine directly. */
export function activityOf(steps: readonly MicroStep[], direction: Direction | null): Activity {
  if (steps.length === 0 || direction === "jump") return NO_ACTIVITY;
  const transfers: Transfer[] = [];
  const active = new Set<Component>();
  const reads = new Set<number>();
  const writes = new Set<number>();
  let branch: Activity["branch"] = null;
  for (const s of steps) {
    for (const e of s.events) {
      if (e.type === "transfer") {
        transfers.push({ from: e.from, to: e.to, value: e.value });
        active.add(e.from).add(e.to);
      } else if (e.type === "memory-read") {
        reads.add(e.address);
        active.add("MEMORY");
      } else if (e.type === "memory-write") {
        writes.add(e.address);
        active.add("MEMORY");
      } else if (e.type === "pc-increment") {
        active.add("PC");
      } else if (e.type === "alu") {
        active.add("ALU");
      } else if (e.type === "decode") {
        active.add("CONTROL");
      } else if (e.type === "branch") {
        branch = { from: e.from, target: e.target, taken: e.taken };
        active.add("CONTROL");
      }
    }
  }
  if (direction === "back") {
    transfers.reverse();
    return {
      transfers: transfers.map((t) => ({ from: t.to, to: t.from, value: t.value })),
      active,
      reads,
      writes,
      branch,
    };
  }
  return { transfers, active, reads, writes, branch };
}
