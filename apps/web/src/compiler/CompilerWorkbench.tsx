"use client";

import { compile, type CompileResult } from "@joes-sim/compiler";
import { DIALECTS, DIALECT_IDS, isDialectId, type DialectId } from "@joes-sim/engine";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ExplainPanel } from "@/sim/panels/ExplainPanel";
import { IOPanel } from "@/sim/panels/IOPanel";
import { StatusLine } from "@/sim/panels/StatusLine";
import { SimProvider, useSim, useSimState } from "@/sim/SimProvider";
import { SPEEDS, SPEED_ORDER, type Speed } from "@/sim/speeds";
import { usePlayback, usePlaybackLoop } from "@/sim/usePlayback";
import { sharePath } from "@/sim/workspace/share";

export const STARTER = `# Add up the numbers from 1 to n
input n
total = 0
i = 1
while i <= n do
  total = total + i
  i = i + 1
end
print total
`;

const KEY = "joes-sim-little-language";
type Target = "classic" | "extended";

/** The learner's program, kept in this browser between visits. */
function loadSaved(): string {
  try {
    return window.localStorage.getItem(KEY) ?? STARTER;
  } catch {
    return STARTER;
  }
}

const subscribe = () => () => undefined;

/** Little Language on the left, LMC on the right, and the machine running it (brief, Phase 9). */
export function CompilerWorkbench() {
  // Read what was saved only in the browser, so the server's page matches the first render.
  const browser = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  // The server draws the starter program, so the page does not jump when it loads; the browser
  // then swaps in the learner's own program.
  return (
    <Workbench key={browser ? "saved" : "starter"} initial={browser ? loadSaved() : STARTER} />
  );
}

function Workbench({ initial }: { initial: string }) {
  const [source, setSource] = useState(initial);
  const [target, setTarget] = useState<Target>("classic");
  const [dialect, setDialect] = useState<DialectId>("classic");
  const [optimise, setOptimise] = useState(false);
  const result = useMemo(
    () => compile(source, { target, dialect, optimise }),
    [source, target, dialect, optimise],
  );
  const other = useMemo(
    () => compile(source, { target, dialect, optimise: !optimise }),
    [source, target, dialect, optimise],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(KEY, source);
      } catch {
        // Storage can be unavailable; the program still works for this visit.
      }
    }, 400);
    return () => clearTimeout(t);
  }, [source]);

  return (
    <SimProvider
      initial={{ source: result.lmc || "        HLT\n", dialect, machine: target, inputText: "10" }}
    >
      <Inner
        source={source}
        setSource={setSource}
        result={result}
        other={other}
        settings={{ target, setTarget, dialect, setDialect, optimise, setOptimise }}
      />
    </SimProvider>
  );
}

interface Settings {
  target: Target;
  setTarget: (t: Target) => void;
  dialect: DialectId;
  setDialect: (d: DialectId) => void;
  optimise: boolean;
  setOptimise: (o: boolean) => void;
}

function Inner({
  source,
  setSource,
  result,
  other,
  settings,
}: {
  source: string;
  setSource: (s: string) => void;
  result: CompileResult;
  other: CompileResult;
  settings: Settings;
}) {
  usePlaybackLoop();
  const store = useSim();
  const state = useSimState((s) => s.state);
  const [selected, setSelected] = useState<number | null>(null);
  const listing = useRef<HTMLOListElement>(null);
  const ids = { target: useId(), dialect: useId(), editor: useId() };

  // Load each new compilation into the machine.
  useEffect(() => {
    const s = store.getState();
    if (s.machine !== settings.target) s.setMachine(settings.target);
    if (s.dialect !== settings.dialect) s.setDialect(settings.dialect);
    if (result.ok && s.source !== result.lmc) s.setSource(result.lmc);
  }, [store, result, settings.target, settings.dialect]);

  // While the program runs, the current instruction and its source line.
  const running = state && state.microSteps > 0 && result.program;
  const currentLmc = running ? (result.program?.addressToLine[state.currentAddress] ?? null) : null;
  const currentSource = running ? (result.addressToSource[state.currentAddress] ?? null) : null;
  // Keep the running instruction in sight.
  useEffect(() => {
    listing.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: "nearest" });
  }, [currentLmc]);
  const selectedLines = new Set(
    selected === null ? [] : (result.sourceToLines[selected - 1] ?? []),
  );

  const counts =
    result.ok && other.ok
      ? settings.optimise
        ? `${result.instructions} instructions with optimisation, ${other.instructions} without.`
        : `${result.instructions} instructions; ${other.instructions} with optimisation.`
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <label htmlFor={ids.target} className="text-sm text-muted">
            Compile for
          </label>
          <select
            id={ids.target}
            value={settings.target}
            onChange={(e) =>
              settings.setTarget(e.target.value === "extended" ? "extended" : "classic")
            }
            className="min-h-11 rounded-sm border border-border-strong bg-surface px-2 text-sm"
          >
            <option value="classic">Classic LMC</option>
            <option value="extended">Extended LMC (subroutines)</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <label htmlFor={ids.dialect} className="text-sm text-muted">
            Dialect
          </label>
          <select
            id={ids.dialect}
            value={settings.dialect}
            onChange={(e) => isDialectId(e.target.value) && settings.setDialect(e.target.value)}
            className="min-h-11 rounded-sm border border-border-strong bg-surface px-2 text-sm"
          >
            {DIALECT_IDS.map((d) => (
              <option key={d} value={d}>
                {DIALECTS[d].name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.optimise}
            onChange={(e) => settings.setOptimise(e.target.checked)}
            className="h-5 w-5"
          />
          Optimise
        </label>
        {counts && <p className="text-sm text-muted">{counts}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby={`${ids.editor}-h`} className="min-w-0 space-y-1">
          <h2 id={`${ids.editor}-h`} className="font-bold">
            Little Language
          </h2>
          <SourceEditor
            id={ids.editor}
            source={source}
            onChange={(s) => {
              setSource(s);
              setSelected(null);
            }}
            onLine={setSelected}
            selected={selected}
            current={currentSource}
          />
        </section>
        <section aria-labelledby={`${ids.editor}-lmc`} className="min-w-0 space-y-1">
          <h2 id={`${ids.editor}-lmc`} className="font-bold">
            Generated LMC
          </h2>
          {result.ok ? (
            <ol
              ref={listing}
              className="max-h-[28rem] overflow-auto rounded-md border border-border bg-surface py-1 font-mono text-sm [font-variant-ligatures:none]"
            >
              {result.lines.map((l, i) => {
                const lineNo = i + 1;
                const on = selectedLines.has(i);
                const now = currentLmc === lineNo;
                return (
                  <li key={i}>
                    {l.source === null ? (
                      <span className="block min-h-6 px-2 whitespace-pre text-muted">
                        {l.text || " "}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelected(l.source)}
                        aria-current={now ? "step" : undefined}
                        className={`block min-h-6 w-full px-2 text-start whitespace-pre ${now ? "bg-accent font-bold text-on-accent" : on ? "bg-branch/15" : ""} ${l.instruction || now ? "" : "text-muted"}`}
                      >
                        {l.text}
                        {l.instruction ? (
                          <span className="sr-only"> (from line {l.source})</span>
                        ) : null}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <ul className="space-y-1 rounded-md border-2 border-danger p-2 text-sm" role="alert">
              {result.errors.map((e, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="text-start underline"
                    onClick={() => setSelected(e.line)}
                  >
                    {e.message}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {result.ok && (
        <>
          <Controls />
          <StatusLine />
          <div className="grid gap-4 lg:grid-cols-2">
            <IOPanel />
            <ExplainPanel />
          </div>
          <p className="text-sm">
            <Link
              href={sharePath({
                name: "Compiled from the Little Language",
                source: result.lmc,
                dialect: settings.dialect,
                machine: settings.target,
                inputs: store.getState().inputText,
                view: "datapath",
              })}
              className="font-bold text-accent underline"
            >
              Open the LMC in the simulator
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

/**
 * A plain text area with a layer behind it that highlights lines: the one selected and the one
 * running. Moving the cursor selects the line under it.
 */
function SourceEditor({
  id,
  source,
  onChange,
  onLine,
  selected,
  current,
}: {
  id: string;
  source: string;
  onChange: (s: string) => void;
  onLine: (line: number) => void;
  selected: number | null;
  current: number | null;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const lines = source.split("\n");
  const lineAt = (pos: number) => source.slice(0, pos).split("\n").length;
  const report = () => {
    const el = area.current;
    if (el) onLine(lineAt(el.selectionStart));
  };
  // When a line is picked on the other side, select it here too.
  useEffect(() => {
    const el = area.current;
    if (!el || selected === null || document.activeElement === el) return;
    const start = lines.slice(0, selected - 1).reduce((n, l) => n + l.length + 1, 0);
    el.setSelectionRange(start, start + (lines[selected - 1]?.length ?? 0));
  }, [selected, lines]);

  return (
    <div className="relative rounded-md border border-border bg-surface font-mono text-sm leading-6 [font-variant-ligatures:none]">
      <div
        ref={backdrop}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden py-1 ps-10 pe-2 whitespace-pre"
      >
        {lines.map((l, i) => (
          <div
            key={i}
            className={`min-h-6 ${current === i + 1 ? "bg-accent/25" : selected === i + 1 ? "bg-branch/15" : ""}`}
          >
            <span className="absolute start-0 w-8 pe-1 text-end text-muted">{i + 1}</span>
            <span className="invisible">{l || " "}</span>
          </div>
        ))}
      </div>
      <label htmlFor={id} className="sr-only">
        Little Language program
      </label>
      <textarea
        id={id}
        ref={area}
        value={source}
        spellCheck={false}
        rows={Math.max(14, lines.length + 1)}
        onChange={(e) => onChange(e.target.value)}
        onSelect={report}
        onKeyUp={report}
        onClick={report}
        onScroll={(e) => {
          if (backdrop.current) backdrop.current.scrollTop = e.currentTarget.scrollTop;
        }}
        className="relative block w-full resize-y bg-transparent py-1 ps-10 pe-2 whitespace-pre text-text caret-text outline-none"
      />
      {current !== null && (
        <p className="sr-only" aria-live="polite">
          Running line {current}.
        </p>
      )}
    </div>
  );
}

/** Reset, step back, step, run or pause, and speed. */
function Controls() {
  const store = useSim();
  const { toggle } = usePlayback();
  const playing = useSimState((s) => s.playing);
  const speed = useSimState((s) => s.speed);
  const state = useSimState((s) => s.state);
  const speedId = useId();
  const a = store.getState();
  const ready = state?.status === "ready";
  const button =
    "min-h-11 rounded-md border border-border-strong bg-surface px-3 text-sm font-bold";
  return (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Run controls">
      <button type="button" className={button} onClick={() => a.reset()}>
        Reset
      </button>
      <button
        type="button"
        className={button}
        onClick={() => a.backInstruction()}
        disabled={playing || !state || state.microSteps === 0}
      >
        Step back
      </button>
      <button
        type="button"
        className={button}
        onClick={() => a.stepInstruction()}
        disabled={!ready || playing}
      >
        Step
      </button>
      <button
        type="button"
        className="min-h-11 rounded-md bg-accent px-4 text-sm font-bold text-on-accent"
        onClick={toggle}
        disabled={!ready && !playing}
      >
        {playing ? "Pause" : "Run"}
      </button>
      <label htmlFor={speedId} className="text-sm text-muted">
        Speed
      </label>
      <select
        id={speedId}
        value={speed}
        onChange={(e) => a.setSpeed(e.target.value as Speed)}
        className="min-h-11 rounded-sm border border-border-strong bg-surface px-2 text-sm"
      >
        {SPEED_ORDER.filter((s) => s !== "manual").map((s) => (
          <option key={s} value={s}>
            {SPEEDS[s].label}
          </option>
        ))}
      </select>
    </div>
  );
}
