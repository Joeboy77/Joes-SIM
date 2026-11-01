"use client";

import {
  assembleCustom,
  createCustomState,
  runCustom,
  shapeOf,
  stepCustom,
  type CustomState,
  type CustomStep,
  type MachineDefinition,
} from "@joes-sim/engine";
import { narrateCustom, type Level } from "@joes-sim/narration";
import { useId, useMemo, useState } from "react";

const STARTER = `// Try your machine
        INP
        STA x
        LDA x
        ADD x
        OUT
        HLT
x       DAT
`;

function parseInputs(text: string): number[] {
  return text
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n));
}

/** Runs a program on a custom machine, with its generated datapath and narration. */
export function MachineTester({ def }: { def: MachineDefinition }) {
  const [source, setSource] = useState(STARTER);
  const [inputText, setInputText] = useState("21");
  const assembled = useMemo(() => assembleCustom(source, def), [source, def]);
  const program = assembled.program;
  const fresh = (text = inputText) =>
    createCustomState(def, program?.memory ?? [], parseInputs(text));
  const [state, setState] = useState<CustomState>(fresh);
  const [last, setLast] = useState<CustomStep | null>(null);
  const [level, setLevel] = useState<Level>("beginner");
  const [shownFor, setShownFor] = useState({ def, program });
  const ids = { src: useId(), inputs: useId(), level: useId() };
  // A changed machine or program starts a new run.
  if (shownFor.def !== def || shownFor.program !== program) {
    setShownFor({ def, program });
    setState(fresh());
    setLast(null);
  }

  const microStep = () => {
    const r = stepCustom(state, def);
    setState(r.state);
    setLast(r.step);
  };
  const instructionStep = () => {
    let s = state;
    let step: CustomStep | null = null;
    do {
      const r = stepCustom(s, def);
      if (r.state === s) break;
      s = r.state;
      step = r.step ?? step;
    } while (s.status === "ready" && !(s.phase === "fetch" && s.index === 0));
    setState(s);
    setLast(step);
  };
  const runAll = () => {
    setState(runCustom(state, def).state);
    setLast(null);
  };
  const button =
    "min-h-11 rounded-md border border-border-strong bg-surface px-3 text-sm font-bold";
  const ready =
    state.status === "ready" ||
    (state.status === "waiting-input" && state.inputIndex < state.inputs.length);
  const status = !program
    ? "Fix the program to run it."
    : state.status === "halted"
      ? `Finished after ${state.cycles} instruction${state.cycles === 1 ? "" : "s"}.`
      : state.status === "error"
        ? `Stopped: ${state.error}`
        : state.status === "waiting-input"
          ? "Waiting for an input."
          : `Ready. ${state.cycles} instruction${state.cycles === 1 ? "" : "s"} done; next: ${state.phase}.`;

  return (
    <section aria-label="Test the machine" className="space-y-3">
      <h2 className="font-bold">Test {def.name}</h2>
      <label htmlFor={ids.src} className="block text-sm font-bold">
        Program
      </label>
      <textarea
        id={ids.src}
        value={source}
        rows={9}
        spellCheck={false}
        onChange={(e) => setSource(e.target.value)}
        className="w-full rounded-md border border-border bg-surface p-2 font-mono text-sm"
      />
      {!program && (
        <ul role="alert" className="space-y-1 rounded-md border-2 border-danger p-2 text-sm">
          {assembled.diagnostics.map((d, i) => (
            <li key={i}>{d.message}</li>
          ))}
        </ul>
      )}
      <div
        className="flex flex-wrap items-center gap-2"
        role="toolbar"
        aria-label="Machine test controls"
      >
        <button
          type="button"
          className={button}
          onClick={() => {
            setState(fresh());
            setLast(null);
          }}
        >
          Reset
        </button>
        <button type="button" className={button} onClick={microStep} disabled={!program || !ready}>
          Micro-step
        </button>
        <button
          type="button"
          className={button}
          onClick={instructionStep}
          disabled={!program || !ready}
        >
          Step
        </button>
        <button
          type="button"
          className="min-h-11 rounded-md bg-accent px-4 text-sm font-bold text-on-accent"
          onClick={runAll}
          disabled={!program || !ready}
        >
          Run
        </button>
        <label htmlFor={ids.inputs} className="text-sm text-muted">
          Inputs
        </label>
        <input
          id={ids.inputs}
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            setState({ ...state, inputs: parseInputs(e.target.value) });
          }}
          className="min-h-11 w-28 rounded-sm border border-border-strong bg-surface px-2 font-mono text-sm"
        />
      </div>
      <p role="status" aria-live="polite" className="text-sm">
        {status}
      </p>
      <CustomDatapath def={def} state={state} step={last} />
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold">What just happened</h3>
        <label htmlFor={ids.level} className="sr-only">
          Explanation level
        </label>
        <select
          id={ids.level}
          value={level}
          onChange={(e) => setLevel(e.target.value === "technical" ? "technical" : "beginner")}
          className="min-h-11 rounded-sm border border-border-strong bg-surface px-2 text-sm"
        >
          <option value="beginner">Beginner</option>
          <option value="technical">Technical</option>
        </select>
      </div>
      <p className="rounded-md border border-border bg-surface p-2 text-sm">
        {last ? narrateCustom(last, level) : "Micro-step to see each register transfer."}
      </p>
      <p className="text-sm">
        Output:{" "}
        <span className="font-mono">
          {state.outputs.length
            ? state.outputs.map((o) => (o.kind === "char" ? o.char : o.value)).join(" ")
            : "nothing yet"}
        </span>
      </p>
      <Memory def={def} state={state} />
    </section>
  );
}

function Memory({ def, state }: { def: MachineDefinition; state: CustomState }) {
  const shown = Math.min(def.memory, 100);
  const digits = String(def.memory - 1).length;
  const fmt = (v: number) =>
    def.word.base === 10 ? String(v) : `${v < 0 ? "-" : ""}${Math.abs(v).toString(def.word.base)}`;
  return (
    <div>
      <h3 className="mb-1 text-sm font-bold">
        Memory{def.memory > shown ? ` (first ${shown} of ${def.memory} words)` : ""}
      </h3>
      <ol
        className="grid grid-cols-5 gap-1 font-mono text-xs sm:grid-cols-10"
        aria-label="Memory words"
      >
        {Array.from({ length: shown }, (_, a) => (
          <li
            key={a}
            className={`rounded-sm border px-1 ${a === state.currentAddress && state.cycles + state.index > 0 ? "border-2 border-accent" : "border-border"}`}
          >
            <span className="block text-[0.6rem] text-muted">
              {String(a).padStart(digits, "0")}
            </span>
            {fmt(state.memory[a] ?? 0)}
          </li>
        ))}
      </ol>
    </div>
  );
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * The datapath, generated from the definition: a box for every register plus memory, the ALU,
 * input and output, and a bus for every pair that some micro-operation connects.
 */
function CustomDatapath({
  def,
  state,
  step,
}: {
  def: MachineDefinition;
  state: CustomState;
  step: CustomStep | null;
}) {
  const { roles } = shapeOf(def);
  const layout = useMemo(() => {
    const boxes = new Map<string, Box>();
    def.registers.forEach((r, i) => {
      boxes.set(r.name, { x: 16 + (i % 2) * 130, y: 16 + Math.floor(i / 2) * 64, w: 116, h: 50 });
    });
    const rows = Math.ceil(def.registers.length / 2);
    const bottom = 16 + rows * 64;
    boxes.set("MEMORY", { x: 300, y: 16, w: 150, h: Math.max(114, bottom - 30) });
    boxes.set("ALU", { x: 300, y: bottom, w: 150, h: 50 });
    boxes.set("INPUT", { x: 16, y: bottom, w: 116, h: 50 });
    boxes.set("OUTPUT", { x: 146, y: bottom, w: 116, h: 50 });
    const buses = new Set<string>();
    const add = (a: string, b: string) => buses.add([a, b].sort().join("|"));
    for (const op of [...def.fetch, ...def.instructions.flatMap((i) => i.micro)]) {
      if (op.op === "copy") add(op.from === "operand" ? roles.ir : op.from, op.to);
      if (op.op === "read") {
        add(roles.mar, "MEMORY");
        add("MEMORY", roles.mdr);
      }
      if (op.op === "write") add(roles.mdr, "MEMORY");
      if (op.op === "alu") {
        add(op.a, "ALU");
        if (op.b) add(op.b, "ALU");
        add("ALU", op.to);
      }
      if (op.op === "input") add("INPUT", op.to);
      if (op.op === "output") add(op.from, "OUTPUT");
      if (op.op === "jump") add(op.to === "operand" ? roles.ir : op.to, roles.pc);
    }
    return {
      boxes,
      buses: [...buses].map((b) => b.split("|") as [string, string]),
      height: bottom + 66,
    };
  }, [def, roles]);

  const active = new Set<string>();
  const moving = new Set<string>();
  for (const e of step?.events ?? []) {
    if (e.type === "transfer") {
      active.add(e.from).add(e.to);
      moving.add([e.from, e.to].sort().join("|"));
    }
    if (e.type === "memory-read" || e.type === "memory-write") active.add("MEMORY");
  }
  const centre = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  const value = (name: string) => {
    if (name === "MEMORY") return `${def.memory} words`;
    if (name === "ALU") return `Z ${state.z ? 1 : 0} · N ${state.n ? 1 : 0}`;
    if (name === "INPUT")
      return state.inputs[state.inputIndex] === undefined
        ? "empty"
        : String(state.inputs[state.inputIndex]);
    if (name === "OUTPUT")
      return state.outputs.length ? String(state.outputs.at(-1)?.value) : "none";
    return String(state.registers[name] ?? 0);
  };
  return (
    <svg
      viewBox={`0 0 466 ${layout.height}`}
      className="h-auto w-full rounded-md border border-border bg-surface"
      role="img"
      aria-label={`Datapath of ${def.name}. ${def.registers.map((r) => `${r.name} ${state.registers[r.name] ?? 0}`).join(", ")}.`}
    >
      {layout.buses.map(([a, b]) => {
        const p = layout.boxes.get(a);
        const q = layout.boxes.get(b);
        if (!p || !q) return null;
        const on = moving.has([a, b].sort().join("|"));
        const s = centre(p);
        const t = centre(q);
        return (
          <line
            key={`${a}-${b}`}
            x1={s.x}
            y1={s.y}
            x2={t.x}
            y2={t.y}
            stroke={on ? "var(--sim-color-accent)" : "var(--sim-color-border)"}
            strokeWidth={on ? 5 : 2}
          />
        );
      })}
      {[...layout.boxes].map(([name, b]) => (
        <g key={name}>
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={8}
            fill="var(--sim-color-surface)"
            stroke={active.has(name) ? "var(--sim-color-accent)" : "var(--sim-color-border-strong)"}
            strokeWidth={active.has(name) ? 4 : 2}
          />
          <text
            x={b.x + 8}
            y={b.y + 18}
            fontSize={12}
            fontWeight={700}
            fill="var(--sim-color-text)"
          >
            {name}
          </text>
          <text
            x={b.x + 8}
            y={b.y + 38}
            fontSize={13}
            fontFamily="var(--font-mono)"
            fill="var(--sim-color-text)"
          >
            {value(name)}
          </text>
        </g>
      ))}
    </svg>
  );
}
