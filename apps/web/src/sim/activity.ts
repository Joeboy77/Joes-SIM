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
  /** A change of PC worth an arrow: a branch, a CALL, a RET (back to the caller) or an interrupt. */
  readonly branch: {
    readonly from: number;
    readonly target: number;
    readonly taken: boolean;
    readonly kind: "branch" | "call" | "return" | "interrupt";
  } | null;
  /** Extended machine: stack mailboxes pushed and popped, and the last device port used. */
  readonly pushed: readonly number[];
  readonly popped: readonly number[];
  readonly devicePort: number | null;
}

export const NO_ACTIVITY: Activity = {
  transfers: [],
  active: new Set(),
  reads: new Set(),
  writes: new Set(),
  branch: null,
  pushed: [],
  popped: [],
  devicePort: null,
};

/** What the last action did, for highlights and animation. Views never look at the engine directly. */
export function activityOf(steps: readonly MicroStep[], direction: Direction | null): Activity {
  if (steps.length === 0 || direction === "jump") return NO_ACTIVITY;
  const transfers: Transfer[] = [];
  const active = new Set<Component>();
  const reads = new Set<number>();
  const writes = new Set<number>();
  let branch: Activity["branch"] = null;
  const pushed: number[] = [];
  const popped: number[] = [];
  let devicePort: number | null = null;
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
        branch = { from: e.from, target: e.target, taken: e.taken, kind: "branch" };
        active.add("CONTROL");
      } else if (e.type === "call") {
        branch = { from: e.from, target: e.target, taken: true, kind: "call" };
      } else if (e.type === "return") {
        branch = { from: e.from, target: e.target, taken: true, kind: "return" };
      } else if (e.type === "interrupt-enter") {
        branch = { from: e.from, target: e.handler, taken: true, kind: "interrupt" };
      } else if (e.type === "stack-push") {
        pushed.push(e.address);
        active.add("SP");
      } else if (e.type === "stack-pop") {
        popped.push(e.address);
        active.add("SP");
      } else if (e.type === "device-read" || e.type === "device-write") {
        devicePort = e.port;
        active.add("DEVICE");
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
      pushed,
      popped,
      devicePort,
    };
  }
  return { transfers, active, reads, writes, branch, pushed, popped, devicePort };
}
