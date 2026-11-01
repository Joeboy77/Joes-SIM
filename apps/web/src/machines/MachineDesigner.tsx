"use client";

import {
  ALU_FNS,
  LMC_DEFINITION,
  LMC_PLUS,
  MICRO_OPS,
  ROLES,
  WHENS,
  checkDefinition,
  parseDefinition,
  type InstructionDef,
  type MachineDefinition,
  type MachineMicroOp,
  type MachineMicroOpKind,
} from "@joes-sim/engine";
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { CommunityError, communityOn, shortenLink } from "@/community/client";
import { MachineTester } from "./MachineTester";

const PRESETS: readonly { readonly id: string; readonly def: MachineDefinition }[] = [
  { id: "lmc", def: LMC_DEFINITION },
  { id: "lmc-plus", def: LMC_PLUS },
];

const KEY = "joes-sim-machine";
const subscribe = () => () => undefined;

/** A machine from the link (?m=…), else the last one edited here, else the LMC preset. */
function startingMachine(): { def: MachineDefinition; fromLink: boolean } {
  const m = new URLSearchParams(window.location.search).get("m");
  if (m) {
    const text = decompressFromEncodedURIComponent(m);
    const parsed = text ? parseDefinition(text) : null;
    if (parsed?.ok) return { def: parsed.definition, fromLink: true };
  }
  try {
    const saved = window.localStorage.getItem(KEY);
    const parsed = saved ? parseDefinition(saved) : null;
    if (parsed?.ok) return { def: parsed.definition, fromLink: false };
  } catch {
    // Storage can be unavailable.
  }
  return { def: LMC_DEFINITION, fromLink: false };
}

export function MachineDesigner() {
  const browser = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!browser) return <p className="text-muted">Loading the machine designer…</p>;
  const start = startingMachine();
  return <Designer initial={start.def} fromLink={start.fromLink} />;
}

const input = "min-h-11 rounded-sm border border-border-strong bg-surface px-2 text-sm";

function Designer({ initial, fromLink }: { initial: MachineDefinition; fromLink: boolean }) {
  const [def, setDefState] = useState<MachineDefinition>(initial);
  const [message, setMessage] = useState<string | null>(
    fromLink ? "Opened the machine from the link." : null,
  );
  const problems = useMemo(() => checkDefinition(def), [def]);
  const ids = {
    preset: useId(),
    name: useId(),
    desc: useId(),
    mem: useId(),
    digits: useId(),
    base: useId(),
    op: useId(),
    file: useId(),
  };

  const setDef = (next: MachineDefinition) => {
    setDefState(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // The machine still works for this visit.
    }
  };
  const patch = (p: Partial<MachineDefinition>) => setDef({ ...def, ...p });
  const registers = def.registers.map((r) => r.name);

  const link = () =>
    `${window.location.origin}/machines?m=${compressToEncodedURIComponent(JSON.stringify(def))}`;
  const download = () => {
    const blob = new Blob([`${JSON.stringify(def, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${def.name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "machine"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={ids.preset} className="text-sm text-muted">
          Start from
        </label>
        <select
          id={ids.preset}
          value=""
          onChange={(e) => {
            const p = PRESETS.find((x) => x.id === e.target.value);
            if (p && window.confirm("Replace this machine with the preset?")) setDef(p.def);
          }}
          className={input}
        >
          <option value="">Choose a preset…</option>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.def.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`${input} font-bold`}
          onClick={download}
          disabled={problems.length > 0}
        >
          Download .json
        </button>
        <label
          htmlFor={ids.file}
          className={`${input} inline-flex cursor-pointer items-center font-bold`}
        >
          Open a .json file
        </label>
        <input
          id={ids.file}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            const parsed = parseDefinition(await f.text());
            if (parsed.ok) {
              setDef(parsed.definition);
              setMessage(`Opened ${f.name}.`);
            } else setMessage(`${f.name} cannot be used: ${parsed.problems.join(" ")}`);
          }}
        />
        <button
          type="button"
          className={`${input} font-bold`}
          disabled={problems.length > 0}
          onClick={() => {
            const url = link();
            void navigator.clipboard?.writeText(url).then(
              () => setMessage("Link copied. Anyone who opens it gets this machine."),
              () => setMessage(`Copy this link: ${url}`),
            );
          }}
        >
          Copy share link
        </button>
        {communityOn && (
          <button
            type="button"
            className={`${input} font-bold`}
            disabled={problems.length > 0}
            onClick={async () => {
              const url = new URL(link());
              try {
                const { id } = await shortenLink(`${url.pathname}${url.search}`);
                const short = `${url.origin}/s/${id}`;
                await navigator.clipboard?.writeText(short).then(
                  () => setMessage(`Short link copied: ${short}`),
                  () => setMessage(`Copy this link: ${short}`),
                );
              } catch (e) {
                setMessage(e instanceof CommunityError ? e.message : "No short link: try again.");
              }
            }}
          >
            Copy short link
          </button>
        )}
      </div>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}

      {problems.length > 0 && (
        <section
          aria-label="Problems with this machine"
          className="rounded-md border-2 border-danger p-3 text-sm"
        >
          <h2 className="mb-1 font-bold text-danger">Fix these before the machine can run</h2>
          <ul className="list-disc space-y-1 ps-5">
            {problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <fieldset className="space-y-2 rounded-md border border-border p-3">
            <legend className="px-1 font-bold">The machine</legend>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor={ids.name} className="text-sm">
                Name
              </label>
              <input
                id={ids.name}
                value={def.name}
                onChange={(e) => patch({ name: e.target.value })}
                className={`${input} grow`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor={ids.desc} className="text-sm">
                Description
              </label>
              <input
                id={ids.desc}
                value={def.description ?? ""}
                onChange={(e) => patch({ description: e.target.value })}
                className={`${input} grow`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor={ids.mem} className="text-sm">
                Memory words
              </label>
              <input
                id={ids.mem}
                type="number"
                min={10}
                max={1000}
                value={def.memory}
                onChange={(e) => patch({ memory: Number(e.target.value) })}
                className={`${input} w-24`}
              />
              <label htmlFor={ids.digits} className="text-sm">
                Word digits
              </label>
              <input
                id={ids.digits}
                type="number"
                min={1}
                max={16}
                value={def.word.digits}
                onChange={(e) => patch({ word: { ...def.word, digits: Number(e.target.value) } })}
                className={`${input} w-20`}
              />
              <label htmlFor={ids.base} className="text-sm">
                Base
              </label>
              <select
                id={ids.base}
                value={def.word.base}
                onChange={(e) =>
                  patch({ word: { ...def.word, base: Number(e.target.value) as 2 | 10 | 16 } })
                }
                className={input}
              >
                <option value={10}>10 (decimal)</option>
                <option value={2}>2 (binary)</option>
                <option value={16}>16 (hexadecimal)</option>
              </select>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={def.word.signed}
                  onChange={(e) => patch({ word: { ...def.word, signed: e.target.checked } })}
                  className="h-5 w-5"
                />
                Negative numbers
              </label>
              <label htmlFor={ids.op} className="text-sm">
                Opcode digits
              </label>
              <input
                id={ids.op}
                type="number"
                min={1}
                max={def.word.digits - 1}
                value={def.opcodeDigits}
                onChange={(e) => patch({ opcodeDigits: Number(e.target.value) })}
                className={`${input} w-20`}
              />
            </div>
          </fieldset>

          <fieldset className="space-y-2 rounded-md border border-border p-3">
            <legend className="px-1 font-bold">Registers</legend>
            <ul className="space-y-1">
              {def.registers.map((r, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    aria-label={`Register ${i + 1} name`}
                    value={r.name}
                    onChange={(e) =>
                      patch({
                        registers: def.registers.map((x, j) =>
                          j === i ? { ...x, name: e.target.value } : x,
                        ),
                      })
                    }
                    className={`${input} w-28 font-mono`}
                  />
                  <select
                    aria-label={`Register ${r.name} role`}
                    value={r.role ?? ""}
                    onChange={(e) =>
                      patch({
                        registers: def.registers.map((x, j) =>
                          j === i
                            ? e.target.value
                              ? { name: x.name, role: e.target.value as (typeof ROLES)[number] }
                              : { name: x.name }
                            : x,
                        ),
                      })
                    }
                    className={input}
                  >
                    <option value="">No special role</option>
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={input}
                    onClick={() => patch({ registers: def.registers.filter((_, j) => j !== i) })}
                  >
                    Remove<span className="sr-only"> register {r.name}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={`${input} font-bold`}
              onClick={() =>
                patch({ registers: [...def.registers, { name: `R${def.registers.length}` }] })
              }
            >
              Add a register
            </button>
          </fieldset>

          <fieldset className="space-y-2 rounded-md border border-border p-3">
            <legend className="px-1 font-bold">Fetch</legend>
            <p className="text-sm text-muted">
              The steps that fetch each instruction. Decoding follows on its own.
            </p>
            <MicroOps
              label="Fetch"
              ops={def.fetch}
              registers={registers}
              onChange={(fetch) => patch({ fetch })}
            />
          </fieldset>

          <section aria-labelledby="instructions-h" className="space-y-2">
            <h2 id="instructions-h" className="font-bold">
              Instructions
            </h2>
            {def.instructions.map((ins, i) => (
              <InstructionEditor
                key={i}
                ins={ins}
                registers={registers}
                onChange={(next) =>
                  patch({ instructions: def.instructions.map((x, j) => (j === i ? next : x)) })
                }
                onRemove={() => patch({ instructions: def.instructions.filter((_, j) => j !== i) })}
              />
            ))}
            <button
              type="button"
              className={`${input} font-bold`}
              onClick={() =>
                patch({
                  instructions: [
                    ...def.instructions,
                    {
                      mnemonic: "NEW",
                      opcode: 4,
                      operand: false,
                      description: "",
                      micro: [{ op: "halt" }],
                    },
                  ],
                })
              }
            >
              Add an instruction
            </button>
          </section>
        </div>

        <div>
          {problems.length === 0 ? (
            <MachineTester def={def} />
          ) : (
            <p className="text-muted">Fix the problems to test the machine.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function InstructionEditor({
  ins,
  registers,
  onChange,
  onRemove,
}: {
  ins: InstructionDef;
  registers: readonly string[];
  onChange: (i: InstructionDef) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const set = (p: Partial<InstructionDef>) => onChange({ ...ins, ...p });
  return (
    <details className="rounded-md border border-border">
      <summary className="min-h-11 cursor-pointer px-3 py-2 font-mono text-sm font-bold">
        {ins.mnemonic || "(no name)"} · opcode {ins.opcode}
        {ins.fixedOperand !== undefined
          ? ` · operand ${ins.fixedOperand}`
          : ins.operand
            ? " · takes an address"
            : ""}
        <span className="ms-2 font-sans font-normal text-muted">{ins.description}</span>
      </summary>
      <div className="space-y-2 border-t border-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`${id}-m`} className="text-sm">
            Mnemonic
          </label>
          <input
            id={`${id}-m`}
            value={ins.mnemonic}
            onChange={(e) => set({ mnemonic: e.target.value.toUpperCase() })}
            className={`${input} w-24 font-mono`}
          />
          <label htmlFor={`${id}-o`} className="text-sm">
            Opcode
          </label>
          <input
            id={`${id}-o`}
            type="number"
            min={0}
            value={ins.opcode}
            onChange={(e) => set({ opcode: Number(e.target.value) })}
            className={`${input} w-20`}
          />
          <label htmlFor={`${id}-k`} className="text-sm">
            Operand
          </label>
          <select
            id={`${id}-k`}
            value={ins.operand ? "address" : ins.fixedOperand !== undefined ? "fixed" : "none"}
            onChange={(e) => {
              const v = e.target.value;
              const { fixedOperand: _f, ...rest } = ins;
              void _f;
              onChange(
                v === "address"
                  ? { ...rest, operand: true }
                  : v === "fixed"
                    ? { ...rest, operand: false, fixedOperand: 0 }
                    : { ...rest, operand: false },
              );
            }}
            className={input}
          >
            <option value="none">None</option>
            <option value="address">An address or value</option>
            <option value="fixed">A fixed number (shares the opcode)</option>
          </select>
          {ins.fixedOperand !== undefined && (
            <input
              aria-label={`${ins.mnemonic} fixed operand`}
              type="number"
              min={0}
              value={ins.fixedOperand}
              onChange={(e) => set({ fixedOperand: Number(e.target.value) })}
              className={`${input} w-20`}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`${id}-d`} className="text-sm">
            Description
          </label>
          <input
            id={`${id}-d`}
            value={ins.description ?? ""}
            onChange={(e) => set({ description: e.target.value })}
            className={`${input} grow`}
          />
        </div>
        <MicroOps
          label={ins.mnemonic}
          ops={ins.micro}
          registers={registers}
          onChange={(micro) => set({ micro })}
        />
        <button type="button" className={input} onClick={onRemove}>
          Remove {ins.mnemonic}
        </button>
      </div>
    </details>
  );
}

const DESCRIBE: Record<MachineMicroOpKind, string> = {
  copy: "Copy a register",
  set: "Set a register to a number",
  read: "Read memory (MDR ← memory[MAR])",
  write: "Write memory (memory[MAR] ← MDR)",
  inc: "Add 1 to a register",
  dec: "Take 1 from a register",
  alu: "Calculate with the ALU",
  input: "Read an input",
  output: "Output a value",
  jump: "Jump (set the PC)",
  halt: "Stop",
};

function blank(op: MachineMicroOpKind, registers: readonly string[]): MachineMicroOp {
  const r = registers.at(-1) ?? "ACC";
  switch (op) {
    case "copy":
      return { op, from: "operand", to: r };
    case "set":
      return { op, reg: r, value: 0 };
    case "inc":
    case "dec":
      return { op, reg: r };
    case "alu":
      return { op, fn: "add", a: r, b: r, to: r };
    case "input":
      return { op, to: r };
    case "output":
      return { op, from: r };
    case "jump":
      return { op, when: "always", to: "operand" };
    default:
      return { op } as MachineMicroOp;
  }
}

/** A list of micro-operations, each built from dropdowns. */
function MicroOps({
  label,
  ops,
  registers,
  onChange,
}: {
  label: string;
  ops: readonly MachineMicroOp[];
  registers: readonly string[];
  onChange: (ops: MachineMicroOp[]) => void;
}) {
  const set = (i: number, op: MachineMicroOp) => onChange(ops.map((x, j) => (j === i ? op : x)));
  const pick = (
    name: string,
    value: string,
    options: readonly string[],
    change: (v: string) => void,
  ) => (
    <select
      aria-label={name}
      value={value}
      onChange={(e) => change(e.target.value)}
      className={input}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o === "operand" ? "the operand" : o}
        </option>
      ))}
    </select>
  );
  const withOperand = ["operand", ...registers];
  return (
    <ol className="space-y-1" aria-label={`${label} micro-operations`}>
      {ops.map((op, i) => {
        const n = `${label} step ${i + 1}`;
        return (
          <li key={i} className="flex flex-wrap items-center gap-1 text-sm">
            <span className="w-6 text-end text-muted">{i + 1}.</span>
            <select
              aria-label={`${n}: operation`}
              value={op.op}
              onChange={(e) => set(i, blank(e.target.value as MachineMicroOpKind, registers))}
              className={input}
            >
              {MICRO_OPS.map((o) => (
                <option key={o} value={o}>
                  {DESCRIBE[o]}
                </option>
              ))}
            </select>
            {op.op === "copy" && (
              <>
                {pick(`${n}: from`, op.from, withOperand, (v) => set(i, { ...op, from: v }))}
                <span>into</span>
                {pick(`${n}: into`, op.to, registers, (v) => set(i, { ...op, to: v }))}
              </>
            )}
            {op.op === "set" && (
              <>
                {pick(`${n}: register`, op.reg, registers, (v) => set(i, { ...op, reg: v }))}
                <span>to</span>
                <input
                  aria-label={`${n}: value`}
                  type="number"
                  value={op.value}
                  onChange={(e) => set(i, { ...op, value: Number(e.target.value) })}
                  className={`${input} w-20`}
                />
              </>
            )}
            {(op.op === "inc" || op.op === "dec") &&
              pick(`${n}: register`, op.reg, registers, (v) => set(i, { ...op, reg: v }))}
            {op.op === "alu" && (
              <>
                {pick(`${n}: into`, op.to, registers, (v) => set(i, { ...op, to: v }))}
                <span>=</span>
                {pick(`${n}: first value`, op.a, registers, (v) => set(i, { ...op, a: v }))}
                {pick(`${n}: function`, op.fn, ALU_FNS, (v) =>
                  set(i, { ...op, fn: v as (typeof ALU_FNS)[number] }),
                )}
                {op.fn !== "negate" &&
                  pick(`${n}: second value`, op.b ?? registers[0] ?? "", registers, (v) =>
                    set(i, { ...op, b: v }),
                  )}
              </>
            )}
            {op.op === "input" &&
              pick(`${n}: into`, op.to, registers, (v) => set(i, { ...op, to: v }))}
            {op.op === "output" && (
              <>
                {pick(`${n}: from`, op.from, registers, (v) => set(i, { ...op, from: v }))}
                {pick(`${n}: as`, op.as ?? "number", ["number", "char"], (v) =>
                  set(i, { ...op, as: v as "number" | "char" }),
                )}
              </>
            )}
            {op.op === "jump" && (
              <>
                {pick(`${n}: when`, op.when, WHENS, (v) =>
                  set(i, { ...op, when: v as (typeof WHENS)[number] }),
                )}
                <span>to</span>
                {pick(`${n}: to`, op.to, withOperand, (v) => set(i, { ...op, to: v }))}
              </>
            )}
            <button
              type="button"
              className={input}
              aria-label={`Move ${n} up`}
              disabled={i === 0}
              onClick={() => {
                const next = [...ops];
                [next[i - 1], next[i]] = [next[i] as MachineMicroOp, next[i - 1] as MachineMicroOp];
                onChange(next);
              }}
            >
              ↑
            </button>
            <button
              type="button"
              className={input}
              aria-label={`Remove ${n}`}
              onClick={() => onChange(ops.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </li>
        );
      })}
      <li>
        <button
          type="button"
          className={`${input} font-bold`}
          onClick={() => onChange([...ops, blank("copy", registers)])}
        >
          Add a step<span className="sr-only"> to {label}</span>
        </button>
      </li>
    </ol>
  );
}
