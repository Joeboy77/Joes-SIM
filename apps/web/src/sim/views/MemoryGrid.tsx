"use client";

import { disassembleWord, formatValue } from "@joes-sim/engine";
import { useSim, useSimState } from "../SimProvider";
import { useActivity } from "../useActivity";

export function MemoryGrid() {
  const store = useSim();
  const state = useSimState((s) => s.state);
  const program = useSimState((s) => s.assembled.program);
  const breakpoints = useSimState((s) => s.breakpoints);
  const dialect = useSimState((s) => s.dialect);
  const { activity } = useActivity();
  if (!state) return null;
  const branch = activity.branch;

  const labelAt = new Map(
    Object.entries(program?.labels ?? {}).map(([name, v]) => [v.address, name]),
  );
  const started = state.microSteps > 0;

  return (
    <div>
      <h2 className="mb-2 text-sm font-bold">Memory</h2>
      <p className="mb-2 text-xs text-muted">
        Click a mailbox to set a breakpoint. <span className="text-read">↓ read</span>{" "}
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
              const marks = [
                current && "running",
                read && "just read",
                written && "just written",
                bp && "breakpoint",
                target && (branch.taken ? "branch target, taken" : "branch target, not taken"),
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => store.getState().toggleBreakpoint(a)}
                  aria-pressed={bp}
                  title={meaning ?? undefined}
                  className={[
                    "relative flex min-h-11 flex-col items-center justify-center rounded-sm border px-0.5 py-1 font-mono leading-none",
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
                  <span className="text-[0.6rem] text-muted">
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
                  {label ? (
                    <span className="max-w-full truncate text-[0.55rem] text-branch">
                      <span className="sr-only">, label </span>
                      {label}
                    </span>
                  ) : null}
                  {meaning ? <span className="sr-only">, {meaning}</span> : null}
                  {marks ? <span className="sr-only">. {marks}</span> : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
