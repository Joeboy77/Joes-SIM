"use client";

import {
  disassembleWord,
  formatValue,
  numberViews,
  usageOf,
  type UsageKind,
} from "@joes-sim/engine";
import { useId, useRef, useState } from "react";
import { useSim, useSimState } from "../SimProvider";
import { useActivity } from "../useActivity";
import { useTrace } from "../useTrace";

const USAGE: Record<UsageKind, string> = {
  code: "code",
  data: "data",
  both: "code+data",
  unused: "unused",
};

export function MemoryGrid() {
  const store = useSim();
  const state = useSimState((s) => s.state);
  const program = useSimState((s) => s.assembled.program);
  const breakpoints = useSimState((s) => s.breakpoints);
  const dialect = useSimState((s) => s.dialect);
  const { activity } = useActivity();
  const heatmap = useSimState((s) => s.heatmap);
  const { trace } = useTrace();
  const [inspect, setInspect] = useState<number | null>(null);
  const press = useRef<{ timer: ReturnType<typeof setTimeout> | null; long: boolean }>({
    timer: null,
    long: false,
  });
  const cardId = useId();
  if (!state) return null;
  const branch = activity.branch;

  const labelAt = new Map(
    Object.entries(program?.labels ?? {}).map(([name, v]) => [v.address, name]),
  );
  const started = state.microSteps > 0;
  const uses = (a: number) =>
    trace ? (trace.executed[a] ?? 0) + (trace.reads[a] ?? 0) + (trace.writes[a] ?? 0) : 0;
  const most = Math.max(1, ...Array.from({ length: 100 }, (_, a) => uses(a)));
  const endPress = () => {
    if (press.current.timer) clearTimeout(press.current.timer);
    press.current.timer = null;
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">Memory</h2>
        <button
          type="button"
          aria-pressed={heatmap}
          onClick={() => store.getState().toggleHeatmap()}
          className={`min-h-11 rounded-sm border px-3 text-sm ${heatmap ? "border-accent bg-accent font-bold text-on-accent" : "border-border-strong bg-surface"}`}
        >
          Heatmap
        </button>
      </div>
      <p className="mb-2 text-xs text-muted">
        Click a mailbox to set a breakpoint; point at it, or press and hold, to see its value in
        binary and hex. <span className="text-read">↓ read</span>{" "}
        <span className="text-write">↑ write</span> <span className="text-accent">▶ running</span>{" "}
        <span className="text-danger">● breakpoint</span>{" "}
        <span className="text-branch">↪ branch target</span>
      </p>
      <div className="grid grid-cols-10 gap-1" role="group" aria-label="Memory: 100 mailboxes">
        {Array.from({ length: 10 }, (_, row) => (
          <div className="contents" key={row}>
            {Array.from({ length: 10 }, (_, col) => {
              const a = row * 10 + col;
              const value = state.memory[a] ?? 0;
              const read = activity.reads.has(a);
              const written = activity.writes.has(a);
              const current = started && a === state.currentAddress;
              const bp = breakpoints.includes(a);
              const target = branch !== null && a === branch.target;
              const label = labelAt.get(a);
              const meaning =
                program?.kinds[a] === "code" ? disassembleWord(value, dialect).text : null;
              const usage = trace ? usageOf(trace, a) : "unused";
              const heat = heatmap ? uses(a) / most : 0;
              const marks = [
                current && "running",
                read && "just read",
                written && "just written",
                bp && "breakpoint",
                target && (branch.taken ? "branch target, taken" : "branch target, not taken"),
              ]
                .filter(Boolean)
                .join(", ");
              const used = heatmap
                ? `. Run ${trace?.executed[a] ?? 0}, read ${trace?.reads[a] ?? 0}, written ${trace?.writes[a] ?? 0} times`
                : "";
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => {
                    // A long press shows the number card instead of setting a breakpoint.
                    if (press.current.long) {
                      press.current.long = false;
                      return;
                    }
                    store.getState().toggleBreakpoint(a);
                  }}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setInspect(a)}
                  onPointerLeave={(e) => e.pointerType === "mouse" && setInspect(null)}
                  onFocus={() => setInspect(a)}
                  onBlur={() => setInspect(null)}
                  onPointerDown={(e) => {
                    if (e.pointerType !== "touch") return;
                    endPress();
                    press.current.timer = setTimeout(() => {
                      press.current.long = true;
                      setInspect(a);
                    }, 500);
                  }}
                  onPointerUp={endPress}
                  onPointerCancel={endPress}
                  onContextMenu={(e) => {
                    // Stop the phone's own long-press menu while a touch press is held.
                    if (press.current.timer || press.current.long) e.preventDefault();
                  }}
                  aria-pressed={bp}
                  aria-describedby={inspect === a ? cardId : undefined}
                  title={meaning ?? undefined}
                  style={
                    heat > 0
                      ? {
                          backgroundColor: `color-mix(in srgb, var(--sim-color-write) ${Math.round(8 + heat * 24)}%, var(--sim-color-surface))`,
                        }
                      : undefined
                  }
                  className={[
                    "relative flex min-h-11 touch-manipulation flex-col items-center justify-center rounded-sm border px-0.5 py-1 font-mono leading-none transition-colors duration-500 select-none",
                    current
                      ? "border-accent bg-surface-2 border-2"
                      : written
                        ? "border-write border-2"
                        : read
                          ? "border-read border-2"
                          : target
                            ? `border-branch border-2 ${branch.taken ? "" : "border-dashed"}`
                            : "border-border",
                    program?.kinds[a] === "empty" ? "text-muted" : "text-text",
                  ].join(" ")}
                >
                  {/* The accessible name is built from the visible text plus hidden words, so it always contains what is shown (WCAG 2.5.3). */}
                  <span className={`text-[0.6rem] ${heat > 0 ? "text-text" : "text-muted"}`}>
                    <span aria-hidden="true">
                      {current ? "▶" : written ? "↑" : read ? "↓" : target ? "↪" : ""}
                    </span>
                    <span className="sr-only">Mailbox </span>
                    {String(a).padStart(2, "0")}
                    {bp ? (
                      <span className="text-danger" aria-hidden="true">
                        {" "}
                        ●
                      </span>
                    ) : null}
                  </span>
                  <span className="sr-only">: </span>
                  <span className="text-sm">{formatValue(value)}</span>
                  {heatmap ? (
                    <span
                      className={`max-w-full truncate text-[0.55rem] ${heat > 0 ? "text-text" : "text-muted"}`}
                    >
                      <span className="sr-only">, used as </span>
                      {USAGE[usage]}
                    </span>
                  ) : label ? (
                    <span className="max-w-full truncate text-[0.55rem] text-branch">
                      <span className="sr-only">, label </span>
                      {label}
                    </span>
                  ) : null}
                  {heatmap && label ? <span className="sr-only">, label {label}</span> : null}
                  {meaning ? <span className="sr-only">, {meaning}</span> : null}
                  {marks ? <span className="sr-only">. {marks}</span> : null}
                  {used ? <span className="sr-only">{used}</span> : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <NumberCard
        id={cardId}
        address={inspect}
        value={inspect === null ? 0 : (state.memory[inspect] ?? 0)}
        label={inspect === null ? undefined : labelAt.get(inspect)}
        dialect={dialect}
        counts={
          inspect === null || !trace
            ? null
            : {
                executed: trace.executed[inspect] ?? 0,
                reads: trace.reads[inspect] ?? 0,
                writes: trace.writes[inspect] ?? 0,
                usage: usageOf(trace, inspect),
              }
        }
      />
    </div>
  );
}

/** Any value in decimal, binary, hexadecimal and two's complement (brief, 7.11). */
function NumberCard({
  id,
  address,
  value,
  label,
  dialect,
  counts,
}: {
  id: string;
  address: number | null;
  value: number;
  label: string | undefined;
  dialect: Parameters<typeof numberViews>[1];
  counts: { executed: number; reads: number; writes: number; usage: UsageKind } | null;
}) {
  if (address === null) {
    return <div id={id} className="mt-2 min-h-16 text-xs text-muted" />;
  }
  const v = numberViews(value, dialect);
  return (
    <div id={id} className="mt-2 min-h-16 rounded-sm border border-border bg-surface p-2 text-xs">
      <p className="font-bold">
        Mailbox {String(address).padStart(2, "0")}
        {label ? ` (${label})` : ""}: {formatValue(value)}
      </p>
      <p className="font-mono">
        Decimal {v.decimal} · Binary {v.binary} · Hex {v.hex} · Two&apos;s complement ({v.bits}
        -bit) {v.twosComplement}
      </p>
      {counts && (
        <p className="text-muted">
          Run {counts.executed}, read {counts.reads}, written {counts.writes} times: used as{" "}
          {USAGE[counts.usage]}.
        </p>
      )}
    </div>
  );
}
