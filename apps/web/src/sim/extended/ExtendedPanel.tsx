"use client";

import { formatValue, type ExtendedState } from "@joes-sim/engine";
import { AnimatePresence, motion } from "motion/react";
import { useSimState } from "../SimProvider";
import { useActivity } from "../useActivity";
import { useTrace } from "../useTrace";
import { Devices } from "./Devices";
import { interruptSpans, stackNotes, type InterruptSpan } from "./model";

const pad = (n: number) => String(n).padStart(2, "0");

/** The extended machine's registers, stack, interrupts and devices (docs/specs/extended.md). */
export function ExtendedPanel() {
  const state = useSimState((s) => s.state);
  const ext = state?.ext;
  if (!state || !ext) return null;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <Registers ext={ext} />
          <Interrupts cycles={state.cycles} />
        </div>
        <StackView memory={state.memory} ext={ext} cycles={state.cycles} />
      </div>
      <Devices />
    </div>
  );
}

function Registers({ ext }: { ext: ExtendedState }) {
  const { activity } = useActivity();
  const cell = (label: string, value: string, on: boolean, hint: string) => (
    <div
      className={`rounded-sm border px-2 py-1 ${on ? "border-2 border-accent" : "border-border"}`}
      title={hint}
    >
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-mono text-sm">{value}</dd>
    </div>
  );
  const pending = [ext.timerPending && "timer", ext.keyboardPending && "keyboard"].filter(Boolean);
  return (
    <section aria-label="Extended registers">
      <h2 className="mb-1 text-sm font-bold">Registers</h2>
      <dl className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        {cell(
          "SP (stack pointer)",
          ext.sp === 100 ? "100 empty" : pad(ext.sp),
          activity.active.has("SP"),
          "The top of the stack",
        )}
        {cell("X (index)", formatValue(ext.x), activity.active.has("X"), "Index register")}
        {cell(
          "Interrupts",
          ext.ie ? "on" : "off",
          false,
          "EI turns interrupts on, DI turns them off",
        )}
        {cell(
          "IV (vector)",
          pad(ext.iv),
          activity.active.has("IV"),
          "Where the interrupt handler starts",
        )}
      </dl>
      <p className="mt-1 text-xs text-muted">
        Waiting to interrupt: {pending.length ? pending.join(" and ") : "nothing"}.
      </p>
    </section>
  );
}

/** The stack as a column of mailboxes growing down from 99, with SP pointing at the top. */
function StackView({
  memory,
  ext,
  cycles,
}: {
  memory: readonly number[];
  ext: ExtendedState;
  cycles: number;
}) {
  const { activity, duration } = useActivity();
  const { trace } = useTrace();
  const notes = trace ? stackNotes(trace.rows, cycles) : null;
  const depth = 100 - ext.sp;
  const entries = Array.from({ length: depth }, (_, i) => ext.sp + i);
  const room = Math.max(0, ext.sp - ext.stackFloor);
  return (
    <section aria-label="Stack" className="min-w-40">
      <h2 className="mb-1 text-sm font-bold">Stack</h2>
      <p className="mb-1 text-xs text-muted">
        {depth === 0 ? "Empty." : `${depth} value${depth === 1 ? "" : "s"}.`} Room for {room} more.
      </p>
      <ol className="flex flex-col font-mono text-sm" aria-label="Stack, top first">
        <li className="flex items-center gap-1 text-accent" aria-hidden="true">
          <span className="font-bold">SP → {ext.sp === 100 ? "100" : pad(ext.sp)}</span>
        </li>
        <AnimatePresence initial={false}>
          {entries.map((address) => {
            const note = notes?.[notes.length - 1 - (address - ext.sp)];
            const pushed = activity.pushed.includes(address);
            return (
              <motion.li
                key={address}
                layout={duration > 0}
                initial={duration > 0 ? { opacity: 0, y: -12 } : false}
                animate={{ opacity: 1, y: 0 }}
                exit={duration > 0 ? { opacity: 0, y: -12 } : { opacity: 0 }}
                transition={{ duration: duration / 1000 }}
                className={`flex items-center justify-between gap-2 rounded-sm border px-2 py-0.5 ${pushed ? "border-2 border-write" : "border-border"}`}
              >
                <span className="text-xs text-muted">{pad(address)}</span>
                <span>{formatValue(memory[address] ?? 0)}</span>
                {note ? <span className="text-xs text-muted">{note}</span> : null}
              </motion.li>
            );
          })}
        </AnimatePresence>
        {activity.popped.length > 0 && (
          <li className="text-xs text-read">↑ took {activity.popped.length} off the stack</li>
        )}
      </ol>
    </section>
  );
}

/** A timeline of the run with a marker for each interrupt, and what is happening now. */
function Interrupts({ cycles }: { cycles: number }) {
  const { trace } = useTrace();
  const maxCycle = useSimState((s) => s.maxCycle);
  const spans = interruptSpans(trace, cycles);
  const current = [...spans].reverse().find((s) => s.end === null);
  const end = Math.max(1, maxCycle, cycles);
  return (
    <section aria-label="Interrupts">
      <h2 className="mb-1 text-sm font-bold">Interrupts</h2>
      {current ? (
        <p className="rounded-sm border-2 border-branch px-2 py-1 text-sm" role="note">
          <span className="font-bold text-branch">⚡ In the {current.source} handler</span> since
          step {current.start}. The main program is paused and carries on at mailbox{" "}
          {pad(current.resume)} after RTI.
        </p>
      ) : (
        <p className="text-sm text-muted">
          {spans.length
            ? `${spans.length} interrupt${spans.length === 1 ? "" : "s"} so far; the main program is running.`
            : "None yet."}
        </p>
      )}
      {spans.length > 0 && <Timeline spans={spans} end={end} cycles={cycles} />}
    </section>
  );
}

function Timeline({
  spans,
  end,
  cycles,
}: {
  spans: readonly InterruptSpan[];
  end: number;
  cycles: number;
}) {
  const x = (step: number) => `${Math.min(100, (step / end) * 100)}%`;
  return (
    <div className="relative mt-2 h-6 rounded-sm bg-surface-2" aria-hidden="true">
      {spans.map((s, i) => (
        <span
          key={i}
          className={`absolute top-0 h-full ${s.source === "timer" ? "bg-branch" : "bg-write"}`}
          style={{
            left: x(s.start - 1),
            width: `max(3px, calc(${x((s.end ?? cycles) - s.start + 1)}))`,
          }}
          title={`${s.source} interrupt at step ${s.start}`}
        />
      ))}
      <span className="absolute top-0 h-full w-0.5 bg-text" style={{ left: x(cycles) }} />
    </div>
  );
}
