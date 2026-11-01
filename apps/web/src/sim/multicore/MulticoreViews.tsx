"use client";

import {
  CORE_NAMES,
  MAX_CORES,
  MIN_CORES,
  canRun,
  detectRaces,
  disassembleWord,
  formatValue,
  pickCore,
  type CoreState,
  type MachineState,
  type Race,
  type ScheduleMode,
} from "@joes-sim/engine";
import { useId, useMemo } from "react";
import { useSim, useSimState } from "../SimProvider";
import { useTrace } from "../useTrace";

const pad = (n: number) => String(n).padStart(2, "0");

/** Each core's colour and the pattern on its shirt, so cores differ by more than colour. */
export const CORE_STYLES = [
  { colour: "var(--sim-color-accent)", pattern: "plain" },
  { colour: "var(--sim-color-branch)", pattern: "stripes" },
  { colour: "var(--sim-color-write)", pattern: "dots" },
  { colour: "var(--sim-color-success)", pattern: "checks" },
] as const;

export const coreName = (i: number) => `${CORE_NAMES[i] ?? `Core ${i}`} (core ${i})`;

/** The races in the run so far, re-read as the trace grows. */
export function useRaces(): Race[] {
  const { trace, version } = useTrace();
  return useMemo(
    () => (trace ? detectRaces(trace.rows) : []),
    // The trace is mutable: its version says when it changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trace, version],
  );
}

function nextCore(state: MachineState): number | null {
  const m = state.multi;
  if (!m || state.status !== "ready") return null;
  return m.active ?? pickCore(state, m)?.core ?? null;
}

const STATUS: Record<CoreState["status"], string> = {
  ready: "running",
  "waiting-input": "waiting for input",
  halted: "halted",
  error: "stopped with an error",
};

/** Datapath view: the cores side by side, each with its own registers. */
export function CoresDatapath() {
  const state = useSimState((s) => s.state);
  const dialect = useSimState((s) => s.dialect);
  if (!state?.multi) return null;
  const m = state.multi;
  const next = nextCore(state);
  return (
    <ol className="grid gap-2 p-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Cores">
      {m.cores.map((c, i) => {
        const style = CORE_STYLES[i] ?? CORE_STYLES[0];
        const nextText = disassembleWord(state.memory[c.pc] ?? 0, dialect, {
          machine: "multicore",
          next: state.memory[(c.pc + 1) % 100] ?? 0,
        }).text;
        return (
          <li
            key={i}
            className={`rounded-md border-2 bg-surface p-2 text-sm ${m.last === i ? "shadow-md" : ""}`}
            style={{ borderColor: style.colour }}
          >
            <p className="mb-1 flex items-center justify-between gap-2">
              <span
                className="rounded-sm px-2 font-bold text-on-accent"
                style={{ background: style.colour }}
              >
                {coreName(i)}
              </span>
              <span className="text-xs text-muted">{STATUS[c.status]}</span>
            </p>
            <dl className="grid grid-cols-2 gap-x-2 font-mono">
              <dt className="font-sans text-xs text-muted">PC</dt>
              <dd>{pad(c.pc)}</dd>
              <dt className="font-sans text-xs text-muted">ACC</dt>
              <dd>{formatValue(c.acc)}</dd>
              <dt className="font-sans text-xs text-muted">Negative</dt>
              <dd>{c.negative ? "set" : "clear"}</dd>
              <dt className="font-sans text-xs text-muted">Steps run</dt>
              <dd>{c.cycles}</dd>
            </dl>
            <p className="mt-1 text-xs">
              {m.last === i ? <strong>Ran the last step. </strong> : null}
              {next === i ? <strong>Runs next. </strong> : null}
              {c.status !== "halted" ? (
                <>
                  Next instruction: <span className="font-mono">{nextText}</span>
                </>
              ) : null}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/** Story view: a Little Man for each core, with his own colour, pattern and name tag. */
export function CoresStory() {
  const state = useSimState((s) => s.state);
  const id = useId().replace(/:/g, "");
  if (!state?.multi) return null;
  const m = state.multi;
  const n = m.cores.length;
  const width = 180 * n;
  return (
    <svg
      viewBox={`0 0 ${width} 240`}
      className="h-auto w-full"
      role="img"
      aria-label={`Story view. ${m.cores
        .map(
          (c, i) =>
            `${coreName(i)}: ${STATUS[c.status]}, counter ${c.pc}, calculator ${formatValue(c.acc)}`,
        )
        .join(". ")}.`}
    >
      <defs>
        {CORE_STYLES.map((s, i) => (
          <pattern key={i} id={`${id}-p${i}`} width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill={s.colour} />
            {s.pattern === "stripes" && <rect width="8" height="3" fill="rgba(255,255,255,0.45)" />}
            {s.pattern === "dots" && <circle cx="4" cy="4" r="1.6" fill="rgba(255,255,255,0.6)" />}
            {s.pattern === "checks" && (
              <>
                <rect width="4" height="4" fill="rgba(255,255,255,0.4)" />
                <rect x="4" y="4" width="4" height="4" fill="rgba(255,255,255,0.4)" />
              </>
            )}
          </pattern>
        ))}
      </defs>
      {m.cores.map((c, i) => {
        const x = 180 * i + 90;
        const busy = m.last === i;
        const halted = c.status === "halted";
        return (
          <g key={i} opacity={halted ? 0.55 : 1}>
            {/* Desk */}
            <rect
              x={x - 70}
              y={170}
              width={140}
              height={14}
              rx={4}
              fill="var(--sim-color-border-strong)"
            />
            {/* The Little Man, raised a little when he ran the last step */}
            <g transform={`translate(${x} ${busy ? 156 : 166})`}>
              <rect x={-9} y={-24} width={7} height={24} rx={3} fill="var(--sim-color-text)" />
              <rect x={2} y={-24} width={7} height={24} rx={3} fill="var(--sim-color-text)" />
              <rect
                x={-16}
                y={-62}
                width={32}
                height={42}
                rx={10}
                fill={`url(#${id}-p${i})`}
                stroke="var(--sim-color-text)"
                strokeWidth={1.5}
              />
              <circle
                cx={0}
                cy={-76}
                r={14}
                fill="#f2c9a0"
                stroke="var(--sim-color-text)"
                strokeWidth={1.5}
              />
              <circle cx={-5} cy={-77} r={1.8} fill="#1b1b1b" />
              <circle cx={5} cy={-77} r={1.8} fill="#1b1b1b" />
              <path d="M-5 -70 Q0 -66 5 -70" stroke="#1b1b1b" strokeWidth={1.5} fill="none" />
              {/* Name tag */}
              <rect
                x={-24}
                y={-52}
                width={48}
                height={16}
                rx={3}
                fill="var(--sim-color-surface)"
                stroke="var(--sim-color-text)"
              />
              <text
                x={0}
                y={-40}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill="var(--sim-color-text)"
              >
                {CORE_NAMES[i]}
              </text>
            </g>
            <text
              x={x}
              y={206}
              textAnchor="middle"
              fontSize={13}
              fontFamily="var(--font-mono)"
              fill="var(--sim-color-text)"
            >
              PC {pad(c.pc)} · ACC {formatValue(c.acc)}
            </text>
            <text
              x={x}
              y={226}
              textAnchor="middle"
              fontSize={12}
              fill="var(--sim-color-text-muted)"
            >
              {busy ? "ran the last step" : STATUS[c.status]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Scheduling, manual stepping, the timeline of which core ran, and the races found. */
export function MulticorePanel() {
  const store = useSim();
  const state = useSimState((s) => s.state);
  const settings = useSimState((s) => s.multicore);
  const playing = useSimState((s) => s.playing);
  const program = useSimState((s) => s.assembled.program);
  const { trace } = useTrace();
  const races = useRaces();
  const id = useId();
  if (!state?.multi) return null;
  const m = state.multi;
  const a = store.getState();
  const mode = settings.schedule.mode;
  const setSchedule = (s: Partial<typeof settings.schedule>) =>
    a.setMulticore({ schedule: { ...settings.schedule, ...s } });
  const rows = trace?.rows ?? [];
  const raceSteps = new Set(races.flatMap((r) => [r.first.step, r.second.step]));
  const labelOf = (address: number) =>
    Object.entries(program?.labels ?? {}).find(([, v]) => v.address === address)?.[0];

  return (
    <section aria-label="Multicore" className="space-y-3">
      <fieldset className="flex flex-wrap items-center gap-2 rounded-sm border border-border p-2">
        <legend className="px-1 text-sm font-bold">Cores and scheduling</legend>
        <label htmlFor={`${id}-cores`} className="text-sm text-muted">
          Cores
        </label>
        <select
          id={`${id}-cores`}
          value={settings.cores}
          onChange={(e) => a.setMulticore({ cores: Number(e.target.value) })}
          className="min-h-11 rounded-sm border border-border-strong bg-surface px-2 text-sm"
        >
          {Array.from({ length: MAX_CORES - MIN_CORES + 1 }, (_, i) => MIN_CORES + i).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-mode`} className="text-sm text-muted">
          Schedule
        </label>
        <select
          id={`${id}-mode`}
          value={mode}
          onChange={(e) => setSchedule({ mode: e.target.value as ScheduleMode })}
          className="min-h-11 rounded-sm border border-border-strong bg-surface px-2 text-sm"
        >
          <option value="round-robin">Round-robin</option>
          <option value="random">Random (seeded)</option>
          <option value="manual">Manual: you choose</option>
        </select>
        {mode === "round-robin" && (
          <>
            <label htmlFor={`${id}-q`} className="text-sm text-muted">
              Turn length
            </label>
            <select
              id={`${id}-q`}
              value={settings.schedule.quantum}
              onChange={(e) => setSchedule({ quantum: Number(e.target.value) })}
              className="min-h-11 rounded-sm border border-border-strong bg-surface px-2 text-sm"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((q) => (
                <option key={q} value={q}>
                  {q} instruction{q === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </>
        )}
        {mode === "random" && (
          <>
            <label htmlFor={`${id}-seed`} className="text-sm text-muted">
              Seed
            </label>
            <input
              id={`${id}-seed`}
              type="number"
              min={1}
              max={99999}
              value={settings.schedule.seed}
              onChange={(e) => {
                const seed = Math.max(1, Math.min(99999, Math.floor(Number(e.target.value)) || 1));
                setSchedule({ seed });
              }}
              className="min-h-11 w-24 rounded-sm border border-border-strong bg-surface px-2 text-sm"
            />
          </>
        )}
      </fieldset>

      {mode === "manual" && (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Run one instruction on a core"
        >
          {m.cores.map((c, i) => (
            <button
              key={i}
              type="button"
              disabled={playing || state.status !== "ready" || !canRun(c, state)}
              onClick={() => a.runCore(i)}
              className="min-h-11 rounded-md border-2 px-3 text-sm font-bold disabled:opacity-50"
              style={{ borderColor: (CORE_STYLES[i] ?? CORE_STYLES[0]).colour }}
            >
              Step {coreName(i)}
            </button>
          ))}
        </div>
      )}

      <div>
        <h3 className="mb-1 text-sm font-bold">Which core ran each step</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">Nothing has run yet.</p>
        ) : (
          <ol className="flex flex-wrap gap-0.5" aria-label="Timeline of cores">
            {rows.slice(-80).map((r) => {
              const core = r.core ?? 0;
              const race = raceSteps.has(r.step);
              return (
                <li key={r.step}>
                  <button
                    type="button"
                    onClick={() => a.goToCycle(r.step)}
                    title={`Step ${r.step}: ${coreName(core)} ran ${r.mnemonic}${race ? " (part of a race)" : ""}`}
                    aria-label={`Step ${r.step}: ${coreName(core)}${race ? ", race" : ""}`}
                    className={`flex h-7 w-6 items-center justify-center rounded-sm text-xs font-bold text-on-accent ${race ? "outline-2 outline-offset-1 outline-danger" : ""}`}
                    style={{ background: (CORE_STYLES[core] ?? CORE_STYLES[0]).colour }}
                  >
                    {race ? "⚡" : (CORE_NAMES[core] ?? "?")[0]}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-sm font-bold">Races</h3>
        {races.length === 0 ? (
          <p className="text-sm text-muted">
            None so far: no two cores have used the same mailbox, with one writing, without holding
            a lock.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {races.map((r) => (
              <li key={r.address} className="rounded-sm border-2 border-danger p-2">
                <span className="font-bold text-danger">
                  ⚡ Mailbox {pad(r.address)}
                  {labelOf(r.address) ? ` (${labelOf(r.address)})` : ""}:
                </span>{" "}
                {coreName(r.first.core)} {r.first.write ? "wrote" : "read"} it at{" "}
                <button
                  type="button"
                  className="text-accent underline"
                  onClick={() => a.goToCycle(r.first.step)}
                >
                  step {r.first.step}
                </button>
                , then {coreName(r.second.core)} {r.second.write ? "wrote" : "read"} it at{" "}
                <button
                  type="button"
                  className="text-accent underline"
                  onClick={() => a.goToCycle(r.second.step)}
                >
                  step {r.second.step}
                </button>
                , with no lock held by both. Another order of steps could give a different result.
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
