"use client";

import {
  STAGES,
  schedulePipeline,
  stageOf,
  stagesAt,
  type PipelineResult,
  type Slot,
  type Stage,
  type TraceRow,
} from "@joes-sim/engine";
import { motion } from "motion/react";
import { useId, useMemo, useState } from "react";
import { useSim, useSimState } from "../SimProvider";
import { useActivity } from "../useActivity";
import { useTrace } from "../useTrace";
import { EmptyMachine } from "./DatapathView";

const STAGE_NAMES: Record<Stage, string> = {
  IF: "Fetch",
  ID: "Decode",
  EX: "Execute",
  MEM: "Memory",
  WB: "Write back",
};

const pad = (n: number) => String(n).padStart(2, "0");
const label = (row: TraceRow | undefined) =>
  !row
    ? "?"
    : row.mnemonic === "INT"
      ? `interrupt (${row.interrupt ?? "device"})`
      : `${row.mnemonic}${row.mode === "indirect" ? " @" : row.mode === "indexed" ? " ,X" : ""} @${pad(row.address)}`;

/** The five-stage pipeline (docs/specs/pipeline.md): stages each cycle, the diagram, the figures. */
export function PipelineView() {
  const store = useSim();
  const state = useSimState((s) => s.state);
  const initial = useSimState((s) => s.initial);
  const options = useSimState((s) => s.pipeline);
  const { trace, version } = useTrace();
  const [chosen, setChosen] = useState<number | null>(null);
  const sliderId = useId();

  const result = useMemo(
    () => (trace && initial ? schedulePipeline(trace.rows, initial.memory, options) : null),
    // The trace is mutable: its version says when it changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trace, version, initial, options],
  );
  if (!state || !trace || !result) return <EmptyMachine />;

  const last = Math.max(1, result.cycles);
  const cycle = Math.min(chosen ?? last, last);
  const rows = trace.rows;
  const a = store.getState();

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="me-auto text-sm font-bold">Five-stage pipeline</h2>
        <Toggle
          on={options.forwarding}
          onClick={() => a.setPipeline({ forwarding: !options.forwarding })}
        >
          Forwarding
        </Toggle>
        <Toggle
          on={options.prediction}
          onClick={() => a.setPipeline({ prediction: !options.prediction })}
        >
          Branch prediction
        </Toggle>
      </div>

      <Figures result={result} />

      {result.instructions.length === 0 ? (
        <p className="text-sm text-muted">
          Step or run the program: each instruction that runs goes through the pipeline.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={sliderId} className="text-sm text-muted">
              Clock cycle
            </label>
            <button
              type="button"
              className="min-h-11 min-w-11 rounded-sm border border-border-strong bg-surface"
              onClick={() => setChosen(Math.max(1, cycle - 1))}
              aria-label="Previous clock cycle"
            >
              ◀
            </button>
            <input
              id={sliderId}
              type="range"
              min={1}
              max={last}
              value={cycle}
              onChange={(e) => setChosen(Number(e.target.value))}
              aria-valuetext={`Clock cycle ${cycle} of ${last}`}
              className="min-w-0 flex-1 accent-[var(--sim-color-accent)]"
            />
            <button
              type="button"
              className="min-h-11 min-w-11 rounded-sm border border-border-strong bg-surface"
              onClick={() => setChosen(cycle >= last ? null : cycle + 1)}
              aria-label="Next clock cycle"
            >
              ▶
            </button>
            <span className="font-mono text-sm tabular-nums">
              {cycle}/{last}
            </span>
          </div>
          <StageStrip result={result} rows={rows} cycle={cycle} />
          <Diagram result={result} rows={rows} cycle={cycle} onPick={setChosen} />
        </>
      )}
    </div>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-11 rounded-sm border px-3 text-sm ${on ? "border-accent bg-accent font-bold text-on-accent" : "border-border-strong bg-surface"}`}
    >
      {children}
    </button>
  );
}

function Figures({ result }: { result: PipelineResult }) {
  const n = result.instructions.length;
  const s = result.stalls;
  const cpi = n ? result.cycles / n : 0;
  const speedup = result.cycles ? result.unpipelinedCycles / result.cycles : 0;
  const item = (term: string, value: string) => (
    <div className="rounded-sm border border-border px-2 py-1">
      <dt className="text-xs text-muted">{term}</dt>
      <dd className="font-mono text-sm">{value}</dd>
    </div>
  );
  return (
    <dl className="grid grid-cols-2 gap-1 sm:grid-cols-4">
      {item("Instructions", String(n))}
      {item("Clock cycles", String(result.cycles))}
      {item("Cycles per instruction", cpi.toFixed(2))}
      {item("Without the pipeline", `${result.unpipelinedCycles} (×${speedup.toFixed(2)} faster)`)}
      <div className="col-span-2 rounded-sm border border-border px-2 py-1 sm:col-span-4">
        <dt className="text-xs text-muted">Stall cycles</dt>
        <dd className="text-sm">
          <span className="font-mono font-bold">{s.total}</span>: {s.data} data, {s.control}{" "}
          control, {s.structural} structural
          {s.selfModifying ? `, ${s.selfModifying} self-modifying` : ""}
        </dd>
      </div>
    </dl>
  );
}

/** The five stages in one clock cycle. Instructions slide from stage to stage. */
function StageStrip({
  result,
  rows,
  cycle,
}: {
  result: PipelineResult;
  rows: readonly TraceRow[];
  cycle: number;
}) {
  const { duration } = useActivity();
  const slots = stagesAt(result, cycle);
  const forwards = result.instructions.flatMap((s) =>
    s.forwards.filter((f) => f.cycle === cycle).map((f) => ({ ...f, to: s.index })),
  );
  const box = (slot: Slot) => {
    if (slot.kind === "bubble") {
      return <span className="text-muted italic">bubble</span>;
    }
    if (slot.kind === "flushed") {
      return (
        <span className="text-danger line-through">
          mailbox {pad(slot.address)} <span className="no-underline">✗ flushed</span>
        </span>
      );
    }
    return (
      <motion.span
        layoutId={`pipe-${slot.index}`}
        transition={{ duration: Math.min(0.4, duration / 1000) || 0.25 }}
        className="block font-mono"
      >
        {label(rows[slot.index])}
        {slot.stalled ? <span className="block text-xs text-danger">stalled</span> : null}
      </motion.span>
    );
  };
  // Where a stage box's centre sits across the strip, for the forwarding arrows.
  const x = (stage: Stage) => (STAGES.indexOf(stage) + 0.5) * 100;
  return (
    <section aria-label={`Pipeline stages in clock cycle ${cycle}`}>
      <ol className="grid grid-cols-5 gap-1">
        {STAGES.map((stage) => {
          const slot = slots[stage];
          return (
            <li
              key={stage}
              className={`min-h-20 rounded-sm border-2 p-1 text-center text-xs sm:text-sm ${slot.kind === "instruction" ? (slot.stalled ? "border-danger" : "border-accent") : "border-dashed border-border"}`}
            >
              <span className="block font-bold">{stage}</span>
              <span className="block text-xs text-muted">{STAGE_NAMES[stage]}</span>
              {box(slot)}
            </li>
          );
        })}
      </ol>
      {forwards.length > 0 && (
        <>
          <svg viewBox="0 0 500 36" className="h-9 w-full" aria-hidden="true">
            <defs>
              <marker
                id="fwd-head"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L10 5 L0 10 Z" fill="var(--sim-color-branch)" />
              </marker>
            </defs>
            {forwards.map((f, i) => {
              const producer = result.instructions[f.from];
              const from = producer ? stageOf(producer, cycle) : "WB";
              const x1 = x(from);
              const x2 = x(f.toStage);
              return (
                <path
                  key={i}
                  d={`M${x1} 4 C${x1} 32 ${x2} 32 ${x2 + (x2 === x1 ? 8 : 0)} 6`}
                  fill="none"
                  stroke="var(--sim-color-branch)"
                  strokeWidth={3}
                  markerEnd="url(#fwd-head)"
                />
              );
            })}
          </svg>
          <ul className="text-sm">
            {forwards.map((f, i) => (
              <li key={i} className="text-branch">
                ↶ {f.resource} forwarded from the end of {f.fromStage} of {label(rows[f.from])} to{" "}
                {f.toStage} of {label(rows[f.to])}.
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

const WINDOW = 9;

/** Instructions against clock cycles, around the chosen cycle. */
function Diagram({
  result,
  rows,
  cycle,
  onPick,
}: {
  result: PipelineResult;
  rows: readonly TraceRow[];
  cycle: number;
  onPick: (c: number) => void;
}) {
  const first = Math.max(1, Math.min(cycle - WINDOW, result.cycles - 2 * WINDOW));
  const lastCycle = Math.min(result.cycles, first + 2 * WINDOW);
  const cycles = Array.from({ length: lastCycle - first + 1 }, (_, i) => first + i);
  const shown = result.instructions.filter((s) => s.start.WB >= first && s.start.IF <= lastCycle);
  const flushed = result.flushed.filter((f) => f.until >= first && f.fetched <= lastCycle);
  type Line =
    | { kind: "instruction"; at: number; s: (typeof shown)[number] }
    | { kind: "flushed"; at: number; f: (typeof flushed)[number] };
  const lines: Line[] = [
    ...shown.map((s) => ({ kind: "instruction" as const, at: s.start.IF, s })),
    ...flushed.map((f) => ({ kind: "flushed" as const, at: f.fetched, f })),
  ].sort((p, q) => p.at - q.at);

  const cell = (line: Line, c: number) => {
    if (line.kind === "flushed") {
      const f = line.f;
      if (c < f.fetched || c > f.until) return null;
      return (
        <span className="text-danger">
          {f.decoded !== undefined && c >= f.decoded ? "ID" : "IF"}✗
        </span>
      );
    }
    const s = line.s;
    if (c < s.start.IF || c > s.start.WB) return null;
    const stage = stageOf(s, c);
    const span = stage === "MEM" ? s.memCycles : 1;
    const stalled = stage !== "WB" && c >= s.start[stage] + span;
    return stalled ? (
      <span className="text-danger" title={`stalled in ${stage}`}>
        {stage}·
      </span>
    ) : (
      <span className="font-bold">{stage}</span>
    );
  };

  return (
    <div
      className="overflow-x-auto"
      role="region"
      aria-label="Pipeline diagram, scrollable"
      tabIndex={0}
    >
      <table className="w-full border-collapse font-mono text-xs">
        <caption className="mb-1 text-start font-sans text-sm font-bold">
          Pipeline diagram: instructions against clock cycles. · marks a stall, ✗ a flushed fetch.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="p-1 text-start font-sans">
              Instruction
            </th>
            {cycles.map((c) => (
              <th
                key={c}
                scope="col"
                className={`min-w-8 p-1 ${c === cycle ? "bg-accent text-on-accent" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  className="min-h-6 w-full"
                  aria-label={`Show clock cycle ${c}`}
                >
                  {c}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className="border-t border-border">
              <th scope="row" className="p-1 text-start font-normal whitespace-nowrap">
                {line.kind === "flushed" ? (
                  <span className="text-danger">flushed: mailbox {pad(line.f.address)}</span>
                ) : (
                  label(rows[line.s.index])
                )}
              </th>
              {cycles.map((c) => (
                <td key={c} className={`p-1 text-center ${c === cycle ? "bg-surface-2" : ""}`}>
                  {cell(line, c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
