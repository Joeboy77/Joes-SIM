"use client";

import { DIALECTS, formatValue } from "@joes-sim/engine";
import { useSimState } from "../SimProvider";

/** One plain sentence about where the machine is. Announced to screen readers. */
export function StatusLine() {
  const state = useSimState((s) => s.state);
  const reason = useSimState((s) => s.stopReason);
  const loop = useSimState((s) => s.loop);
  const dialect = useSimState((s) => s.dialect);
  const busy = useSimState((s) => s.busy);
  const errors = useSimState(
    (s) => s.assembled.diagnostics.filter((d) => d.severity === "error").length,
  );

  let text: string;
  let tone = "text-text";
  if (!state) {
    text = `The program has ${errors} error${errors === 1 ? "" : "s"} to fix before it can run.`;
    tone = "text-danger";
  } else if (busy) {
    text = "Running…";
  } else if (reason === "infinite-loop" && loop) {
    text = `This program can never stop: from step ${loop.startCycle} it repeats the same ${loop.length} instruction${loop.length === 1 ? "" : "s"} forever, starting at mailbox ${String(loop.startAddress).padStart(2, "0")}.`;
    tone = "text-danger";
  } else if (state.status === "halted") {
    text = `Finished after ${state.cycles} instruction${state.cycles === 1 ? "" : "s"}.`;
    tone = "text-success";
  } else if (state.status === "error" && state.error) {
    text = `Stopped at mailbox ${String(state.error.address).padStart(2, "0")}: ${state.error.message}`;
    tone = "text-danger";
  } else if (state.status === "waiting-input") {
    text = "Waiting for an input. Type a value in the Inputs panel.";
  } else if (reason === "breakpoint") {
    text = `Paused at the breakpoint on mailbox ${String(state.pc).padStart(2, "0")}.`;
  } else if (reason === "budget") {
    text = "Paused after a very long run. Press Run to continue.";
  } else if (state.microSteps === 0) {
    text = "Ready. Press Run, or step through one instruction at a time.";
  } else {
    text = `Step ${state.cycles}. Next instruction at mailbox ${String(state.pc).padStart(2, "0")}; accumulator ${formatValue(state.acc)}.`;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2 px-3 py-1.5 text-sm">
      <p role="status" aria-live="polite" className={tone}>
        {text}
      </p>
      <p className="text-muted">
        Dialect: <span className="font-bold text-text">{DIALECTS[dialect].name}</span>
      </p>
    </div>
  );
}
