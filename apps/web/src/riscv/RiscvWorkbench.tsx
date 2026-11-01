"use client";

import {
  ABI_NAMES,
  DATA_BASE,
  assembleRiscv,
  createRvState,
  load,
  runRv,
  stepRv,
  type RvProgram,
  type RvState,
  type RvStep,
} from "@joes-sim/engine";
import { narrateRv, type Level } from "@joes-sim/narration";
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * The level of the workbench's own headings: under a lesson's h3 title they are h4; on a page of
 * their own, straight under the h1, they are h2.
 */
const SubHeading = createContext<"h2" | "h4">("h4");
function Sub({ className, children }: { className: string; children: React.ReactNode }) {
  return useContext(SubHeading) === "h2" ? (
    <h2 className={className}>{children}</h2>
  ) : (
    <h4 className={className}>{children}</h4>
  );
}

const hex = (n: number) => `0x${(n >>> 0).toString(16).padStart(8, "0")}`;
type Stage = "IF" | "ID" | "EX" | "MEM" | "WB";
const STAGES: readonly Stage[] = ["IF", "ID", "EX", "MEM", "WB"];
const STAGE_NAMES: Record<Stage, string> = {
  IF: "Fetch",
  ID: "Decode",
  EX: "Execute",
  MEM: "Memory",
  WB: "Write back",
};

export interface RiscvWorkbenchProps {
  readonly initial: string;
  readonly inputs?: string;
  /** A smaller layout for lessons: no data memory, fewer controls. */
  readonly compact?: boolean;
  readonly title?: string;
  /** Called when the source changes, to save it. */
  readonly onSource?: (source: string) => void;
}

function parseInputs(text: string): number[] {
  return text
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n));
}

/** The RISC-V machine (docs/specs/riscv.md): editor, program, registers, datapath, console. */
export function RiscvWorkbench({
  initial,
  inputs = "",
  compact = false,
  title,
  onSource,
}: RiscvWorkbenchProps) {
  const [source, setSource] = useState(initial);
  const [inputText, setInputText] = useState(inputs);
  const assembled = useMemo(() => assembleRiscv(source), [source]);
  const program = assembled.program;
  const [state, setState] = useState<RvState>(() => createRvState(parseInputs(inputs)));
  const [last, setLast] = useState<RvStep | null>(null);
  const [stage, setStage] = useState<Stage>("WB");
  const [level, setLevel] = useState<Level>("beginner");
  const [showHex, setShowHex] = useState(false);
  const ids = { editor: useId(), inputs: useId(), level: useId() };

  const reset = (text = inputText) => {
    setState(createRvState(parseInputs(text)));
    setLast(null);
  };

  const step = () => {
    if (!program) return;
    const r = stepRv(state, program);
    setState(r.state);
    setLast(r.step);
    // With reduced motion the stages are shown all at once, not one after another.
    setStage(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "WB" : "IF");
  };
  const back = () => {
    if (!program || state.steps === 0) return;
    // The machine is deterministic: replay from the start to one instruction earlier.
    const start = createRvState(parseInputs(inputText));
    const before = runRv(start, program, state.steps - 1).state;
    setState(before);
    setLast(state.steps > 1 ? replayLastStep(start, program, state.steps - 1) : null);
    setStage("WB");
  };
  const runAll = () => {
    if (!program) return;
    const r = runRv(state, program);
    setState(r.state);
    setLast(
      r.state.steps > 0
        ? replayLastStep(createRvState(parseInputs(inputText)), program, r.state.steps)
        : null,
    );
    setStage("WB");
  };

  // Walk through the stages of the last instruction, one after another.
  useEffect(() => {
    if (!last || stage === "WB") return;
    const t = setTimeout(() => setStage(STAGES[STAGES.indexOf(stage) + 1] as Stage), 450);
    return () => clearTimeout(t);
  }, [last, stage]);

  const ready = state.status === "ready";
  const status = !program
    ? `The program has ${assembled.diagnostics.length} error${assembled.diagnostics.length === 1 ? "" : "s"} to fix.`
    : state.status === "halted"
      ? `Finished after ${state.steps} instruction${state.steps === 1 ? "" : "s"} (${state.ended}${state.ended === "exit with code" ? ` ${state.exitCode}` : ""}).`
      : state.status === "error"
        ? `Stopped: ${state.error}`
        : state.status === "waiting-input"
          ? "The program asked for an integer (ecall 5). Type it in the inputs and press Step or Run."
          : state.steps === 0
            ? "Ready. Step through one instruction at a time, or run."
            : `Step ${state.steps}. Next instruction at ${hex(state.pc)}.`;
  const button =
    "min-h-11 rounded-md border border-border-strong bg-surface px-3 text-sm font-bold";

  return (
    <SubHeading.Provider value={title ? "h4" : "h2"}>
      <section aria-label={title ?? "RISC-V machine"} className="space-y-3">
        {title && <h3 className="font-bold">{title}</h3>}
        <div className={`grid gap-3 ${compact ? "" : "lg:grid-cols-2"}`}>
          <div className="min-w-0 space-y-1">
            <label htmlFor={ids.editor} className="block text-sm font-bold">
              RISC-V assembly
            </label>
            <textarea
              id={ids.editor}
              value={source}
              spellCheck={false}
              rows={compact ? 10 : 18}
              onChange={(e) => {
                setSource(e.target.value);
                onSource?.(e.target.value);
                // A new program starts a new run.
                reset();
              }}
              className="w-full rounded-md border border-border bg-surface p-2 font-mono text-sm [font-variant-ligatures:none]"
            />
            {!program && (
              <ul role="alert" className="space-y-1 rounded-md border-2 border-danger p-2 text-sm">
                {assembled.diagnostics.map((d, i) => (
                  <li key={i}>{d.message}</li>
                ))}
              </ul>
            )}
          </div>
          {program && <Listing program={program} pc={state.pc} />}
        </div>

        <div
          className="flex flex-wrap items-center gap-2"
          role="toolbar"
          aria-label="RISC-V run controls"
        >
          <button type="button" className={button} onClick={() => reset()}>
            Reset
          </button>
          <button
            type="button"
            className={button}
            onClick={back}
            disabled={!program || state.steps === 0}
          >
            Step back
          </button>
          <button
            type="button"
            className={button}
            onClick={step}
            disabled={
              !program ||
              !(
                ready ||
                (state.status === "waiting-input" && state.inputIndex < state.inputs.length)
              )
            }
          >
            Step
          </button>
          <button
            type="button"
            className="min-h-11 rounded-md bg-accent px-4 text-sm font-bold text-on-accent"
            onClick={runAll}
            disabled={!program || state.status === "halted" || state.status === "error"}
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
              // Inputs given while waiting are added to the run; otherwise the run starts again.
              if (state.status === "waiting-input")
                setState({ ...state, inputs: parseInputs(e.target.value) });
              else reset(e.target.value);
            }}
            className="min-h-11 w-32 rounded-sm border border-border-strong bg-surface px-2 font-mono text-sm"
          />
        </div>
        <p role="status" aria-live="polite" className="text-sm">
          {status}
        </p>

        {program && (
          <>
            <Datapath step={last} stage={stage} onStage={setStage} />
            <div className="flex flex-wrap items-center gap-2">
              <Sub className="text-sm font-bold">What just happened</Sub>
              <label htmlFor={ids.level} className="sr-only">
                Explanation level
              </label>
              <select
                id={ids.level}
                value={level}
                onChange={(e) =>
                  setLevel(e.target.value === "technical" ? "technical" : "beginner")
                }
                className="min-h-11 rounded-sm border border-border-strong bg-surface px-2 text-sm"
              >
                <option value="beginner">Beginner</option>
                <option value="technical">Technical</option>
              </select>
            </div>
            <p className="rounded-md border border-border bg-surface p-2 text-sm">
              {last ? narrateRv(last, level) : "Step to see what each instruction does."}
            </p>
            <div className={`grid gap-3 ${compact ? "" : "lg:grid-cols-2"}`}>
              <Registers
                state={state}
                written={last?.writeBack?.rd ?? null}
                showHex={showHex}
                onHex={setShowHex}
              />
              <div className="space-y-3">
                <div>
                  <Sub className="mb-1 text-sm font-bold">Console</Sub>
                  <pre
                    tabIndex={0}
                    role="region"
                    aria-label={`Console: ${state.console || "empty"}`}
                    className="min-h-16 overflow-x-auto rounded-sm bg-[#111] p-2 font-mono text-sm whitespace-pre-wrap text-[#e6ffe6]"
                  >
                    {state.console || " "}
                  </pre>
                </div>
                {!compact && <DataMemory state={state} program={program} />}
              </div>
            </div>
          </>
        )}
      </section>
    </SubHeading.Provider>
  );
}

/** The step that the last of `steps` instructions made, by replaying to just before it. */
function replayLastStep(start: RvState, program: RvProgram, steps: number): RvStep | null {
  const before = runRv(start, program, steps - 1).state;
  return stepRv(before, program).step;
}

function Listing({ program, pc }: { program: RvProgram; pc: number }) {
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    list.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: "nearest" });
  }, [pc]);
  return (
    <div className="min-w-0 space-y-1">
      <Sub className="text-sm font-bold">Assembled program</Sub>
      <ol
        ref={list}
        // It scrolls, so it must be reachable by keyboard.
        tabIndex={0}
        aria-label="Assembled instructions: address, machine code, instruction"
        className="max-h-80 overflow-auto rounded-md border border-border bg-surface py-1 font-mono text-xs [font-variant-ligatures:none]"
      >
        {program.text.map((ins) => {
          const now = ins.address === pc >>> 0;
          return (
            <li
              key={ins.address}
              aria-current={now ? "step" : undefined}
              className={`flex gap-3 px-2 whitespace-pre ${now ? "bg-accent font-bold text-on-accent" : ""}`}
            >
              <span>{hex(ins.address)}</span>
              <span>{hex(ins.word)}</span>
              <span className="grow">{ins.basic}</span>
              <span className={now ? "" : "text-muted"}>line {ins.line}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Registers({
  state,
  written,
  showHex,
  onHex,
}: {
  state: RvState;
  written: number | null;
  showHex: boolean;
  onHex: (h: boolean) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <Sub className="text-sm font-bold">Registers</Sub>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showHex}
            onChange={(e) => onHex(e.target.checked)}
            className="h-5 w-5"
          />
          Hexadecimal
        </label>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 font-mono text-xs sm:grid-cols-4">
        <div className="col-span-2 flex justify-between gap-2 sm:col-span-4">
          <dt>pc</dt>
          <dd>{hex(state.pc)}</dd>
        </div>
        {state.regs.map((v, i) => (
          <div
            key={i}
            className={`flex justify-between gap-1 rounded-sm px-1 ${written === i && i !== 0 ? "bg-write/20 font-bold" : ""}`}
          >
            <dt>
              {ABI_NAMES[i]} <span className="text-muted">x{i}</span>
            </dt>
            <dd>{showHex ? hex(v) : v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function DataMemory({ state, program }: { state: RvState; program: RvProgram }) {
  const words = Array.from({ length: 16 }, (_, i) => DATA_BASE + i * 4);
  return (
    <div>
      <Sub className="mb-1 text-sm font-bold">Data memory (from {hex(DATA_BASE)})</Sub>
      <dl className="grid grid-cols-2 gap-x-3 font-mono text-xs">
        {words.map((a) => (
          <div key={a} className="flex justify-between gap-2">
            <dt className="text-muted">{hex(a)}</dt>
            <dd>{load(state, program, a, 4)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

interface Part {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly label: string;
}

const PARTS: Record<string, Part> = {
  pc: { x: 16, y: 110, w: 70, h: 56, label: "PC" },
  add4: { x: 110, y: 16, w: 90, h: 44, label: "PC + 4" },
  imem: { x: 110, y: 96, w: 120, h: 84, label: "Instruction memory" },
  regs: { x: 262, y: 86, w: 140, h: 104, label: "Registers" },
  imm: { x: 262, y: 214, w: 140, h: 44, label: "Immediate" },
  alu: { x: 432, y: 104, w: 90, h: 70, label: "ALU" },
  dmem: { x: 556, y: 96, w: 130, h: 84, label: "Data memory" },
};

/** The single-cycle RISC-V datapath, lighting the parts each stage used. */
function Datapath({
  step,
  stage,
  onStage,
}: {
  step: RvStep | null;
  stage: Stage;
  onStage: (s: Stage) => void;
}) {
  const used: Record<Stage, string[]> = {
    IF: ["pc", "imem", "add4"],
    ID: ["regs", "imm"],
    EX: ["alu"],
    MEM: step?.memory ? ["dmem"] : [],
    WB: [...(step?.writeBack ? ["regs"] : []), "pc"],
  };
  const lit = new Set(step ? used[stage] : []);
  const values: Record<string, string> = step
    ? {
        pc: hex(step.address).slice(4),
        add4: hex(step.address + 4).slice(4),
        imem: hex(step.word),
        regs: `${ABI_NAMES[step.decode.rs1]}=${step.decode.rs1Value}`,
        imm: String(step.decode.imm),
        alu:
          step.execute.taken === undefined
            ? String(step.execute.result)
            : step.execute.taken
              ? "taken"
              : "not taken",
        dmem: step.memory
          ? `${step.memory.write ? "write" : "read"} ${step.memory.value}`
          : "unused",
      }
    : {};
  const stageText = !step
    ? "Step an instruction to see the datapath."
    : stage === "IF"
      ? `Fetch: the PC (${hex(step.address)}) reads ${hex(step.word)} from instruction memory.`
      : stage === "ID"
        ? `Decode: ${step.text}. Read ${ABI_NAMES[step.decode.rs1]} = ${step.decode.rs1Value} and ${ABI_NAMES[step.decode.rs2]} = ${step.decode.rs2Value}; the immediate is ${step.decode.imm}.`
        : stage === "EX"
          ? `Execute: the ALU ${step.execute.operation === "compare" ? `compares ${step.execute.a} and ${step.execute.b}: ${step.execute.taken ? "the branch is taken" : "the branch is not taken"}` : `works out ${step.execute.operation} of ${step.execute.a} and ${step.execute.b}: ${step.execute.result}`}.`
          : stage === "MEM"
            ? step.memory
              ? `Memory: ${step.memory.write ? "write" : "read"} ${step.memory.value} ${step.memory.write ? "to" : "from"} ${hex(step.memory.address)}.`
              : "Memory: not used by this instruction."
            : `Write back: ${step.writeBack ? `${ABI_NAMES[step.writeBack.rd]} ← ${step.writeBack.value}` : "no register is written"}; the PC becomes ${hex(step.nextPc)}.`;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Stage of the last instruction">
        {STAGES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={stage === s}
            disabled={!step}
            onClick={() => onStage(s)}
            className={`min-h-11 rounded-sm border px-3 text-sm ${stage === s && step ? "border-accent bg-accent font-bold text-on-accent" : "border-border-strong bg-surface"}`}
          >
            {s} <span className="hidden sm:inline">· {STAGE_NAMES[s]}</span>
          </button>
        ))}
      </div>
      <svg
        viewBox="0 0 702 270"
        className="h-auto w-full"
        role="img"
        aria-label={`RISC-V datapath. ${stageText}`}
      >
        {[
          ["pc", "imem"],
          ["pc", "add4"],
          ["imem", "regs"],
          ["imem", "imm"],
          ["regs", "alu"],
          ["imm", "alu"],
          ["alu", "dmem"],
        ].map(([a, b]) => {
          const p = PARTS[a as string] as Part;
          const q = PARTS[b as string] as Part;
          const on = lit.has(a as string) && lit.has(b as string);
          return (
            <line
              key={`${a}-${b}`}
              x1={p.x + p.w}
              y1={p.y + p.h / 2}
              x2={q.x}
              y2={q.y + q.h / 2}
              stroke={on ? "var(--sim-color-accent)" : "var(--sim-color-border)"}
              strokeWidth={on ? 4 : 2}
            />
          );
        })}
        {Object.entries(PARTS).map(([key, p]) => (
          <g key={key}>
            <rect
              x={p.x}
              y={p.y}
              width={p.w}
              height={p.h}
              rx={8}
              fill="var(--sim-color-surface)"
              stroke={lit.has(key) ? "var(--sim-color-accent)" : "var(--sim-color-border-strong)"}
              strokeWidth={lit.has(key) ? 4 : 2}
            />
            <text
              x={p.x + 8}
              y={p.y + 18}
              fontSize={12}
              fontWeight={700}
              fill="var(--sim-color-text)"
            >
              {p.label}
            </text>
            <text
              x={p.x + 8}
              y={p.y + 38}
              fontSize={12}
              fontFamily="var(--font-mono)"
              fill="var(--sim-color-text)"
            >
              {values[key] ?? ""}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-sm">{stageText}</p>
    </div>
  );
}
