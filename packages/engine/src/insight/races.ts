/**
 * Race detection for the multicore machine (docs/specs/multicore.md): two accesses to the same
 * mailbox, from different cores, at least one a write, while the cores held no lock in common.
 */
import type { TraceRow } from "./trace";

export interface RaceAccess {
  readonly step: number;
  readonly core: number;
  readonly write: boolean;
}

export interface Race {
  readonly address: number;
  /** The earlier access and the later one that conflicts with it. */
  readonly first: RaceAccess;
  readonly second: RaceAccess;
}

interface Seen extends RaceAccess {
  readonly locks: ReadonlySet<number>;
}

const shareLock = (a: ReadonlySet<number>, b: ReadonlySet<number>) => [...a].some((l) => b.has(l));

/** Finds the races in a multicore run, one per mailbox, in the order they happen. */
export function detectRaces(rows: readonly TraceRow[]): Race[] {
  const lockWords = new Set(
    rows.filter((r) => r.mnemonic === "TAS" && r.read).map((r) => r.read?.address as number),
  );
  const held = new Map<number, Set<number>>();
  const lastWrite = new Map<number, Seen>();
  const lastReads = new Map<number, Map<number, Seen>>();
  const races = new Map<number, Race>();

  const access = (row: TraceRow, address: number, write: boolean) => {
    const core = row.core ?? 0;
    if (lockWords.has(address) || races.has(address)) return;
    const now: Seen = { step: row.step, core, write, locks: new Set(held.get(core) ?? []) };
    const conflict = (other: Seen | undefined) =>
      other && other.core !== core && !shareLock(other.locks, now.locks) ? other : undefined;
    const w = conflict(lastWrite.get(address));
    const r = write
      ? [...(lastReads.get(address)?.values() ?? [])].find((x) => conflict(x))
      : undefined;
    const clash = w ?? r;
    if (clash) {
      races.set(address, {
        address,
        first: { step: clash.step, core: clash.core, write: clash.write },
        second: { step: now.step, core, write },
      });
      return;
    }
    if (write) lastWrite.set(address, now);
    else {
      const reads = lastReads.get(address) ?? new Map<number, Seen>();
      reads.set(core, now);
      lastReads.set(address, reads);
    }
  };

  for (const row of rows) {
    const core = row.core ?? 0;
    // TAS that read 0 takes the lock; writing 0 to a lock releases it.
    if (row.mnemonic === "TAS" && row.read) {
      if (row.read.value === 0) {
        const set = held.get(core) ?? new Set<number>();
        set.add(row.read.address);
        held.set(core, set);
      }
      continue;
    }
    if (row.write && lockWords.has(row.write.address) && row.write.value === 0) {
      held.get(core)?.delete(row.write.address);
      continue;
    }
    if (row.read) access(row, row.read.address, false);
    if (row.write) access(row, row.write.address, true);
  }
  return [...races.values()].sort((a, b) => a.second.step - b.second.step);
}
