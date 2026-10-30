"use client";

import { DIALECTS, DIALECT_IDS, isDialectId } from "@joes-sim/engine";
import { useId, useState } from "react";
import { usePlayback } from "../usePlayback";
import { useSim, useSimState } from "../SimProvider";
import { SPEEDS, SPEED_ORDER, type Speed } from "../speeds";

function Button({
  label,
  shortcut,
  onClick,
  disabled,
  primary,
  children,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-keyshortcuts={shortcut}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={[
        "inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border px-3 text-sm font-bold disabled:opacity-40",
        primary
          ? "border-accent bg-accent text-on-accent"
          : "border-border-strong bg-surface text-text",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function RunBar() {
  const store = useSim();
  const { toggle } = usePlayback();
  const state = useSimState((s) => s.state);
  const playing = useSimState((s) => s.playing);
  const busy = useSimState((s) => s.busy);
  const speed = useSimState((s) => s.speed);
  const dialect = useSimState((s) => s.dialect);
  const maxCycle = useSimState((s) => s.maxCycle);
  const view = useSimState((s) => s.view);
  const speedId = useId();
  const dialectId = useId();
  const timelineId = useId();
  const [settings, setSettings] = useState(false);

  const ready = state?.status === "ready";
  const atStart = !state || state.microSteps === 0;
  const a = store.getState();

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2"
      role="toolbar"
      aria-label="Run controls"
    >
      <Button label="Reset" shortcut="R" onClick={() => a.reset()} disabled={!state}>
        <span aria-hidden="true">⟲</span>
        <span className="hidden sm:inline">Reset</span>
      </Button>
      <Button
        label="Step back one instruction"
        shortcut="Shift+S"
        onClick={() => a.backInstruction()}
        disabled={atStart || playing}
      >
        <span aria-hidden="true">⏮</span>
      </Button>
      <Button
        label="Step back one micro-step"
        shortcut="Shift+M"
        onClick={() => a.back()}
        disabled={atStart || playing}
      >
        <span aria-hidden="true">◀</span>
      </Button>
      <Button
        label={playing || busy ? "Pause" : "Run"}
        shortcut="P"
        onClick={toggle}
        disabled={!state || (!ready && !playing) || speed === "manual"}
        primary
      >
        <span aria-hidden="true">{playing || busy ? "⏸" : "▶"}</span>
        <span>{playing || busy ? "Pause" : "Run"}</span>
      </Button>
      <Button
        label="Step one micro-step"
        shortcut="M"
        onClick={() => a.stepMicro()}
        disabled={!ready || playing}
      >
        <span aria-hidden="true">▷</span>
        <span className="hidden sm:inline">Micro</span>
      </Button>
      <Button
        label="Step one instruction"
        shortcut="S"
        onClick={() => a.stepInstruction()}
        disabled={!ready || playing}
      >
        <span aria-hidden="true">⏭</span>
        <span className="hidden sm:inline">Step</span>
      </Button>

      <button
        type="button"
        className="min-h-11 min-w-11 rounded-md border border-border-strong bg-surface px-3 text-sm font-bold lg:hidden"
        aria-expanded={settings}
        onClick={() => setSettings(!settings)}
      >
        <span aria-hidden="true">⚙</span> <span className="sr-only">Speed, dialect and view</span>
      </button>

      <div className="order-last flex w-full min-w-40 items-center gap-2 lg:order-none lg:w-auto lg:flex-1">
        <label htmlFor={timelineId} className="text-sm text-muted">
          Step
        </label>
        <input
          id={timelineId}
          type="range"
          min={0}
          max={Math.max(maxCycle, 1)}
          value={state?.cycles ?? 0}
          disabled={!state || maxCycle === 0 || playing}
          onChange={(e) => a.jumpToCycle(Number(e.target.value))}
          aria-valuetext={`Instruction ${state?.cycles ?? 0} of ${maxCycle}`}
          className="flex-1 accent-[var(--sim-color-accent)]"
        />
        <span className="font-mono text-sm tabular-nums" aria-hidden="true">
          {state?.cycles ?? 0}/{maxCycle}
        </span>
      </div>

      <div
        className={`${settings ? "flex" : "hidden"} w-full flex-wrap items-center gap-2 lg:flex lg:w-auto`}
      >
        <div className="flex items-center gap-1">
          <label htmlFor={speedId} className="text-sm text-muted">
            Speed
          </label>
          <select
            id={speedId}
            value={speed}
            onChange={(e) => a.setSpeed(e.target.value as Speed)}
            className="min-h-11 rounded-sm border border-border-strong bg-surface px-2 text-sm text-text"
          >
            {SPEED_ORDER.map((s) => (
              <option key={s} value={s}>
                {SPEEDS[s].label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <label htmlFor={dialectId} className="text-sm text-muted">
            Dialect
          </label>
          <select
            id={dialectId}
            value={dialect}
            onChange={(e) => isDialectId(e.target.value) && a.setDialect(e.target.value)}
            className="min-h-11 rounded-sm border border-border-strong bg-surface px-2 text-sm text-text"
          >
            {DIALECT_IDS.map((d) => (
              <option key={d} value={d}>
                {DIALECTS[d].name}
              </option>
            ))}
          </select>
        </div>

        <Button
          label={view === "datapath" ? "Switch to story view" : "Switch to datapath view"}
          shortcut="V"
          onClick={() => a.setView(view === "datapath" ? "story" : "datapath")}
        >
          {view === "datapath" ? "Story view" : "Datapath view"}
        </Button>
        <Button label="Presentation mode" shortcut="F" onClick={() => a.togglePresentation()}>
          <span aria-hidden="true">⛶</span>
        </Button>
      </div>
    </div>
  );
}
