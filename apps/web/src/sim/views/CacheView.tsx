"use client";

import {
  BLOCK_SIZES,
  SET_COUNTS,
  WAY_COUNTS,
  cachedAccesses,
  checkCache,
  simulateCache,
  step,
  type Access,
  type AccessResult,
  type CacheConfig,
  type CacheResult,
  type MachineState,
} from "@joes-sim/engine";
import { motion } from "motion/react";
import { useId, useMemo } from "react";
import { useSim, useSimState } from "../SimProvider";
import { useActivity } from "../useActivity";
import { EmptyMachine } from "./DatapathView";

const pad = (n: number) => String(n).padStart(2, "0");

interface Log {
  state: MachineState;
  all: Access[];
}

/** One log per run (keyed by its starting state), extended a step at a time. */
const logs = new WeakMap<MachineState, Log>();

/**
 * Every memory access of the run up to `cycles`. The log is kept between renders, so a long run is
 * not replayed from the start on every step.
 */
function accessesUpTo(initial: MachineState, cycles: number): Access[] {
  let log = logs.get(initial);
  if (!log) {
    log = { state: initial, all: [] };
    logs.set(initial, log);
  }
  let s = log.state;
  while (s.cycles < cycles && s.status === "ready") {
    const r = step(s, { granularity: "instruction" });
    if (r.state === s) break;
    for (const st of r.steps) {
      const fetch = st.op === "fetch-read" || st.op === "operand-fetch-read";
      for (const e of st.events) {
        if (e.type === "memory-read") {
          log.all.push({ address: e.address, write: false, fetch, step: r.state.cycles });
        } else if (e.type === "memory-write") {
          log.all.push({ address: e.address, write: true, step: r.state.cycles });
        }
      }
    }
    s = r.state;
  }
  log.state = s;
  return log.all.filter((a) => (a.step ?? 0) <= cycles);
}

/** The cache between the processor and the mailboxes (docs/specs/cache.md). */
export function CacheView() {
  const state = useSimState((s) => s.state);
  const initial = useSimState((s) => s.initial);
  const config = useSimState((s) => s.cache);
  const cycles = state?.cycles ?? 0;
  const problem = checkCache(config);
  const result = useMemo(() => {
    if (problem || !initial) return null;
    return simulateCache(cachedAccesses(accessesUpTo(initial, cycles), config), config);
  }, [initial, cycles, config, problem]);
  if (!state) return <EmptyMachine />;

  const current = result?.accesses.filter((a) => a.step === state.cycles) ?? [];
  const last = current.at(-1) ?? null;

  return (
    <div className="space-y-3 p-3">
      <h2 className="text-sm font-bold">Cache</h2>
      <Settings config={config} />
      {problem ? (
        <p className="text-sm text-danger" role="alert">
          {problem}
        </p>
      ) : result ? (
        <>
          <LastAccess access={last} count={current.length} config={config} />
          <Sets result={result} last={last} />
          <Stats result={result} />
        </>
      ) : null}
    </div>
  );
}

function Settings({ config }: { config: CacheConfig }) {
  const store = useSim();
  const id = useId();
  const set = (c: Partial<CacheConfig>) => store.getState().setCache(c);
  const select = (
    key: "blockSize" | "sets" | "ways",
    text: string,
    values: readonly number[],
    name: (v: number) => string,
  ) => (
    <div className="flex items-center gap-1">
      <label htmlFor={`${id}-${key}`} className="text-sm text-muted">
        {text}
      </label>
      <select
        id={`${id}-${key}`}
        value={config[key]}
        onChange={(e) => set({ [key]: Number(e.target.value) })}
        className="min-h-11 rounded-sm border border-border-strong bg-surface px-2 text-sm"
      >
        {values.map((v) => (
          <option key={v} value={v}>
            {name(v)}
          </option>
        ))}
      </select>
    </div>
  );
  const kind =
    config.sets === 1
      ? "fully associative"
      : config.ways === 1
        ? "direct-mapped"
        : `${config.ways}-way set-associative`;
  return (
    <fieldset className="space-y-2 rounded-sm border border-border p-2">
      <legend className="px-1 text-sm font-bold">Settings</legend>
      <div className="flex flex-wrap gap-2">
        {select("blockSize", "Block", BLOCK_SIZES, (v) => `${v} mailbox${v === 1 ? "" : "es"}`)}
        {select("sets", "Sets", SET_COUNTS, String)}
        {select("ways", "Ways", WAY_COUNTS, String)}
        <div className="flex items-center gap-1">
          <label htmlFor={`${id}-rep`} className="text-sm text-muted">
            Replacement
          </label>
          <select
            id={`${id}-rep`}
            value={config.replacement}
            onChange={(e) => set({ replacement: e.target.value as CacheConfig["replacement"] })}
            className="min-h-11 rounded-sm border border-border-strong bg-surface px-2 text-sm"
          >
            <option value="lru">Least recently used</option>
            <option value="fifo">First in, first out</option>
            <option value="random">Random</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <label htmlFor={`${id}-write`} className="text-sm text-muted">
            Writes
          </label>
          <select
            id={`${id}-write`}
            value={config.write}
            onChange={(e) => set({ write: e.target.value as CacheConfig["write"] })}
            className="min-h-11 rounded-sm border border-border-strong bg-surface px-2 text-sm"
          >
            <option value="write-back">Write-back</option>
            <option value="write-through">Write-through</option>
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.fetches ?? false}
            onChange={(e) => set({ fetches: e.target.checked })}
            className="h-5 w-5"
          />
          Cache instruction fetches too
        </label>
      </div>
      <p className="text-xs text-muted">
        A {kind} cache holding {config.blockSize * config.sets * config.ways} mailboxes. A miss
        costs {config.missPenalty ?? 10} cycles; a hit {config.hitTime ?? 1}.
      </p>
    </fieldset>
  );
}

/** The latest access: the address split into tag, index and offset, and what happened. */
function LastAccess({
  access,
  count,
  config,
}: {
  access: AccessResult | null;
  count: number;
  config: CacheConfig;
}) {
  const { duration, reduced } = useActivity();
  if (!access) {
    return (
      <p className="text-sm text-muted">
        {config.fetches
          ? "The last step made no memory access."
          : "The last step did not read or write data. Step to an LDA, ADD, SUB, STA or similar."}
      </p>
    );
  }
  const { split } = access;
  const field = (bits: string, name: string, value: number, colour: string) =>
    bits ? (
      <span className="inline-flex flex-col items-center">
        <span className={`rounded-sm border-2 px-1 font-mono text-base tracking-widest ${colour}`}>
          {bits}
        </span>
        <span className="text-xs">
          {name} {value}
        </span>
      </span>
    ) : null;
  const first = access.address - split.offset;
  const delay = reduced ? 0 : Math.max(0.3, duration / 1000);
  return (
    <section aria-label="Last access" className="space-y-2 rounded-sm border border-border p-2">
      <p className="text-sm">
        {count > 1 ? `Last of ${count} accesses this step: ` : ""}
        <strong>
          {access.write ? "Write" : access.fetch ? "Fetch" : "Read"} mailbox {pad(access.address)}
        </strong>{" "}
        = {access.address.toString(2).padStart(7, "0")} in binary
      </p>
      <div className="flex flex-wrap items-start gap-1" aria-label="Address split into fields">
        {field(split.bits.tag, "tag", split.tag, "border-accent")}
        {field(split.bits.index, "set", split.index, "border-branch")}
        {field(split.bits.offset, "offset", split.offset, "border-write")}
      </div>
      {access.hit ? (
        <motion.p
          key={`${access.step}-${access.address}-hit`}
          initial={reduced ? false : { scale: 0.95, opacity: 0.4 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-sm border-2 border-success px-2 py-1 font-bold text-success"
          role="status"
        >
          ✓ Hit in set {split.index}, way {access.way}.
          {access.writtenThrough ? " The write also goes to memory (write-through)." : ""}
        </motion.p>
      ) : (
        <div role="status" className="space-y-1">
          <p className="rounded-sm border-2 border-danger px-2 py-1 font-bold text-danger">
            ✗ Miss ({access.miss}).{" "}
            {access.way === undefined
              ? "A write miss with write-through: the write goes to memory and nothing is loaded."
              : `Fetching mailboxes ${pad(first)}–${pad(first + config.blockSize - 1)} from memory…`}
          </p>
          {access.way !== undefined && (
            <motion.p
              key={`${access.step}-${access.address}-load`}
              initial={reduced ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay, duration: 0.3 }}
              className="text-sm"
            >
              …loaded into set {split.index}, way {access.way}.
              {access.evicted
                ? ` It replaced mailboxes ${pad(access.evicted.block)}–${pad(access.evicted.block + config.blockSize - 1)}${access.evicted.dirty ? ", which were dirty and written back to memory first" : ""}.`
                : ""}
            </motion.p>
          )}
        </div>
      )}
    </section>
  );
}

function Sets({ result, last }: { result: CacheResult; last: AccessResult | null }) {
  const { blockSize, ways } = result.config;
  const chosen = last?.split.index;
  return (
    <div
      className="overflow-x-auto"
      role="region"
      aria-label="Cache contents, scrollable"
      tabIndex={0}
    >
      <table className="w-full border-collapse font-mono text-xs">
        <caption className="mb-1 text-start font-sans text-sm font-bold">Cache contents</caption>
        <thead>
          <tr>
            <th scope="col" className="p-1 text-start font-sans">
              Set
            </th>
            {Array.from({ length: ways }, (_, w) => (
              <th key={w} scope="col" className="p-1 text-start font-sans">
                Way {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.sets.map((lines, i) => (
            <tr
              key={i}
              className={`border-t border-border ${i === chosen ? "outline-2 -outline-offset-2 outline-branch" : ""}`}
            >
              <th scope="row" className="p-1 text-start">
                {i}
                {i === chosen ? <span className="sr-only"> (this access)</span> : null}
              </th>
              {lines.map((l, w) => {
                const here = i === chosen && w === last?.way;
                return (
                  <td
                    key={w}
                    className={`p-1 ${here ? (last?.hit ? "bg-success/15 font-bold" : "bg-danger/10 font-bold") : ""}`}
                  >
                    {l.valid ? (
                      <>
                        tag {l.tag} · {pad(l.block)}–{pad(l.block + blockSize - 1)}
                        {l.dirty ? (
                          <span title="dirty: changed since it was loaded"> · D</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted">empty</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stats({ result }: { result: CacheResult }) {
  const s = result.stats;
  const item = (term: string, value: string) => (
    <div className="rounded-sm border border-border px-2 py-1">
      <dt className="text-xs text-muted">{term}</dt>
      <dd className="font-mono text-sm">{value}</dd>
    </div>
  );
  return (
    <dl className="grid grid-cols-2 gap-1 sm:grid-cols-4">
      {item("Accesses", `${s.accesses} (${s.reads} reads, ${s.writes} writes)`)}
      {item("Hits", String(s.hits))}
      {item("Hit rate", s.accesses ? `${(s.hitRate * 100).toFixed(1)}%` : "–")}
      {item("Average access time", s.accesses ? `${s.averageAccessTime.toFixed(2)} cycles` : "–")}
      <div className="col-span-2 rounded-sm border border-border px-2 py-1">
        <dt className="text-xs text-muted">Misses</dt>
        <dd className="text-sm">
          <span className="font-mono font-bold">{s.misses.total}</span>: {s.misses.compulsory}{" "}
          compulsory, {s.misses.capacity} capacity, {s.misses.conflict} conflict
        </dd>
      </div>
      {item("Written back", String(s.writeBacks))}
      {item("Written through", String(s.writesThrough))}
    </dl>
  );
}
