"use client";

import { DIALECTS, DIALECT_IDS, isDialectId } from "@joes-sim/engine";
import { useId, useState } from "react";
import { useT } from "@/i18n/useLocale";
import { usePlayback } from "../usePlayback";
import { useSim, useSimState } from "../SimProvider";
import { SPEEDS, SPEED_ORDER, type Speed } from "../speeds";
import { VIEW_ORDER, type ViewMode } from "../store";

export const VIEW_LABELS: Record<ViewMode, string> = {
  datapath: "Datapath",
  story: "Story",
  flow: "Flow graph",
  pipeline: "Pipeline",
  cache: "Cache",
};

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
  const machine = useSimState((s) => s.machine);
  const machineId = useId();
  const maxCycle = useSimState((s) => s.maxCycle);
  const view = useSimState((s) => s.view);
  const speedId = useId();
  const dialectId = useId();
  const viewId = useId();
  const timelineId = useId();
  const [settings, setSettings] = useState(false);
  const t = useT();

  const ready = state?.status === "ready";
  const atStart = !state || state.microSteps === 0;
  const a = store.getState();

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2"
      role="toolbar"
      aria-label={t("run.toolbar")}
    >
      <Button label={t("run.reset")} shortcut="R" onClick={() => a.reset()} disabled={!state}>
        <span aria-hidden="true">⟲</span>
        <span className="hidden sm:inline">{t("run.reset")}</span>
      </Button>
      <Button
        label={t("run.backInstruction")}
        shortcut="Shift+S"
        onClick={() => a.backInstruction()}
        disabled={atStart || playing}
      >
        <span aria-hidden="true">⏮</span>
      </Button>
      <Button
        label={t("run.backMicro")}
        shortcut="Shift+M"
        onClick={() => a.back()}
        disabled={atStart || playing}
      >
        <span aria-hidden="true">◀</span>
      </Button>
      <Button
        label={playing || busy ? t("run.pause") : t("run.run")}
        shortcut="P"
        onClick={toggle}
        disabled={!state || (!ready && !playing) || speed === "manual"}
        primary
      >
        <span aria-hidden="true">{playing || busy ? "⏸" : "▶"}</span>
        <span>{playing || busy ? t("run.pause") : t("run.run")}</span>
      </Button>
      <Button
        label={t("run.microLabel")}
        shortcut="M"
        onClick={() => a.stepMicro()}
        disabled={!ready || playing}
      >
        <span aria-hidden="true">▷</span>
        <span className="hidden sm:inline">{t("run.micro")}</span>
      </Button>
      <Button
        label={t("run.stepLabel")}
        shortcut="S"
        onClick={() => a.stepInstruction()}
        disabled={!ready || playing}
      >
        <span aria-hidden="true">⏭</span>
        <span className="hidden sm:inline">{t("run.step")}</span>
      </Button>

      <button
        type="button"
        className="min-h-11 min-w-11 rounded-md border border-border-strong bg-surface px-3 text-sm font-bold lg:hidden"
        aria-expanded={settings}
        onClick={() => setSettings(!settings)}
      >
        <span aria-hidden="true">⚙</span> <span className="sr-only">{t("run.settings")}</span>
      </button>

      <div className="order-last flex w-full min-w-48 items-center gap-2 lg:order-none lg:w-auto lg:flex-1">
        <label htmlFor={timelineId} className="text-sm text-muted">
          {t("run.timeline")}
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
          className="w-full min-w-0 flex-1 accent-[var(--sim-color-accent)]"
        />
        <span className="shrink-0 font-mono text-sm tabular-nums" aria-hidden="true">
          {state?.cycles ?? 0}/{maxCycle}
        </span>
      </div>

      <div
        className={`${settings ? "flex" : "hidden"} w-full flex-wrap items-center gap-2 lg:flex lg:w-auto`}
      >
        <div className="flex items-center gap-1">
          <label htmlFor={speedId} className="text-sm text-muted">
            {t("run.speed")}
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
          <label htmlFor={machineId} className="text-sm text-muted">
            {t("run.machine")}
          </label>
          <select
            id={machineId}
            value={machine}
            onChange={(e) => a.setMachine(e.target.value === "extended" ? "extended" : "classic")}
            className="min-h-11 rounded-sm border border-border-strong bg-surface px-2 text-sm text-text"
          >
            <option value="classic">{t("run.machineClassic")}</option>
            <option value="extended">{t("run.machineExtended")}</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <label htmlFor={dialectId} className="text-sm text-muted">
            {t("run.dialect")}
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

        <div className="flex items-center gap-1">
          <label htmlFor={viewId} className="text-sm text-muted">
            {t("run.view")}
          </label>
          <select
            id={viewId}
            value={view}
            aria-keyshortcuts="V"
            onChange={(e) => a.setView(e.target.value as ViewMode)}
            className="min-h-11 rounded-sm border border-border-strong bg-surface px-2 text-sm text-text"
          >
            {VIEW_ORDER.map((v) => (
              <option key={v} value={v}>
                {VIEW_LABELS[v]}
              </option>
            ))}
          </select>
        </div>
        <Button label={t("run.presentation")} shortcut="F" onClick={() => a.togglePresentation()}>
          <span aria-hidden="true">⛶</span>
        </Button>
      </div>
    </div>
  );
}
