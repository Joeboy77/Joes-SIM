"use client";

import {
  conditionValue,
  describeCondition,
  isValidCondition,
  numberViews,
  type CompareOp,
  type ConditionTarget,
  type Program,
} from "@joes-sim/engine";
import { useId, useState } from "react";
import { useSim, useSimState } from "../SimProvider";
import { useTrace } from "../useTrace";

type Kind = ConditionTarget["kind"];
const KINDS: { id: Kind; label: string }[] = [
  { id: "acc", label: "Accumulator" },
  { id: "pc", label: "Program counter" },
  { id: "mailbox", label: "Mailbox" },
  { id: "outputs", label: "Number of outputs" },
];
const OPS: { id: CompareOp; label: string }[] = [
  { id: "==", label: "=" },
  { id: "!=", label: "≠" },
  { id: "<", label: "<" },
  { id: "<=", label: "≤" },
  { id: ">", label: ">" },
  { id: ">=", label: "≥" },
];

const pad = (a: number) => String(a).padStart(2, "0");

function targetName(t: ConditionTarget, program: Program | null): string {
  switch (t.kind) {
    case "acc":
      return "Accumulator";
    case "pc":
      return "Program counter";
    case "outputs":
      return "Number of outputs";
    case "mailbox": {
      const label = Object.entries(program?.labels ?? {}).find(
        ([, v]) => v.address === t.address,
      )?.[0];
      return label ? `${label} (mailbox ${pad(t.address)})` : `Mailbox ${pad(t.address)}`;
    }
  }
}

/** Reads a target picker: a kind, and a mailbox given by label or number. */
function parseTarget(kind: Kind, mailbox: string, program: Program | null): ConditionTarget | null {
  if (kind !== "mailbox") return { kind };
  const byLabel = program?.labels[mailbox.trim()]?.address;
  const address = byLabel ?? (/^\d{1,2}$/.test(mailbox.trim()) ? Number(mailbox) : NaN);
  return Number.isInteger(address) && address >= 0 && address < 100
    ? { kind: "mailbox", address }
    : null;
}

function TargetPicker({
  kind,
  setKind,
  mailbox,
  setMailbox,
  prefix,
}: {
  kind: Kind;
  setKind: (k: Kind) => void;
  mailbox: string;
  setMailbox: (m: string) => void;
  prefix: string;
}) {
  const kindId = useId();
  const mailboxId = useId();
  return (
    <>
      <div>
        <label htmlFor={kindId} className="block text-muted">
          {prefix}
        </label>
        <select
          id={kindId}
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          className="min-h-11 rounded-sm border border-border-strong bg-surface px-2"
        >
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      {kind === "mailbox" && (
        <div>
          <label htmlFor={mailboxId} className="block text-muted">
            Label or number
          </label>
          <input
            id={mailboxId}
            value={mailbox}
            onChange={(e) => setMailbox(e.target.value)}
            className="min-h-11 w-28 rounded-sm border border-border-strong bg-surface px-2"
          />
        </div>
      )}
    </>
  );
}

/** Watches, number views (brief, 7.11) and run-until conditions. */
export function WatchPanel() {
  const store = useSim();
  const state = useSimState((s) => s.state);
  const program = useSimState((s) => s.assembled.program);
  const dialect = useSimState((s) => s.dialect);
  const watches = useSimState((s) => s.watches);
  const conditions = useSimState((s) => s.conditions);
  const metCondition = useSimState((s) => s.metCondition);
  const { trace } = useTrace();

  const [watchKind, setWatchKind] = useState<Kind>("mailbox");
  const [watchMailbox, setWatchMailbox] = useState("");
  const [condKind, setCondKind] = useState<Kind>("acc");
  const [condMailbox, setCondMailbox] = useState("");
  const [op, setOp] = useState<CompareOp>("==");
  const [value, setValue] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const opId = useId();
  const valueId = useId();

  if (!state)
    return <p className="text-sm text-muted">Fix the errors in your program to watch it run.</p>;

  // The value before the last completed instruction, to show what just changed.
  const rows = trace?.rows ?? [];
  const previous = (t: ConditionTarget): number | null => {
    if (rows.length === 0 || !trace) return null;
    const before = rows.length >= 2 ? rows[rows.length - 2] : null;
    switch (t.kind) {
      case "acc":
        return before ? before.acc : trace.initial.acc;
      case "pc":
        return before ? before.pc : trace.initial.pc;
      case "outputs":
        return rows.slice(0, -1).filter((r) => r.output).length;
      case "mailbox": {
        const last = rows.at(-1);
        return last?.write?.address === t.address
          ? last.write.previous
          : (state.memory[t.address] ?? 0);
      }
    }
  };

  const addWatch = () => {
    const t = parseTarget(watchKind, watchMailbox, program);
    if (!t) return setError("Give a mailbox label from your program, or a number from 0 to 99.");
    setError(null);
    store.getState().addWatch(t);
    setWatchMailbox("");
  };
  const addCondition = () => {
    const t = parseTarget(condKind, condMailbox, program);
    const n = Number(value);
    const c = t ? { target: t, op, value: n } : null;
    if (!c || !/^-?\d+$/.test(value.trim()) || !isValidCondition(c)) {
      return setError("Choose what to test and give a whole number to compare it with.");
    }
    setError(null);
    store.getState().addCondition(c);
  };

  return (
    <div className="space-y-6">
      <section aria-labelledby="watch-h" className="space-y-2">
        <h2 id="watch-h" className="text-sm font-bold">
          Watches
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Watched values, in decimal, binary, hexadecimal and two&apos;s complement
            </caption>
            <thead>
              <tr className="text-left">
                <th scope="col" className="border-b border-border px-1 py-1">
                  Value of
                </th>
                <th scope="col" className="border-b border-border px-1 py-1">
                  Now
                </th>
                <th scope="col" className="border-b border-border px-1 py-1">
                  Binary
                </th>
                <th scope="col" className="border-b border-border px-1 py-1">
                  Hex
                </th>
                <th scope="col" className="border-b border-border px-1 py-1">
                  Two&apos;s complement
                </th>
                <th scope="col" className="border-b border-border px-1 py-1">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {watches.map((w, i) => {
                const now = conditionValue(w, state);
                const before = previous(w);
                const changed = before !== null && before !== now;
                const views = numberViews(now, dialect);
                return (
                  <tr key={JSON.stringify(w)}>
                    <th
                      scope="row"
                      className="border-b border-border px-1 py-1 text-left font-sans font-normal"
                    >
                      {targetName(w, program)}
                    </th>
                    <td className="border-b border-border px-1 py-1 font-bold">
                      {now}
                      {changed && (
                        <span className="font-sans text-xs font-normal text-write">
                          {" "}
                          changed, was {before}
                        </span>
                      )}
                    </td>
                    <td className="border-b border-border px-1 py-1">{views.binary}</td>
                    <td className="border-b border-border px-1 py-1">{views.hex}</td>
                    <td className="border-b border-border px-1 py-1">{views.twosComplement}</td>
                    <td className="border-b border-border px-1 py-1">
                      <button
                        type="button"
                        onClick={() => store.getState().removeWatch(i)}
                        aria-label={`Stop watching ${targetName(w, program)}`}
                        className="min-h-11 min-w-11 rounded-sm font-sans text-muted"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">
          Two&apos;s complement shows the {numberViews(0, dialect).bits}-bit pattern a real computer
          would store for each value.
        </p>
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <TargetPicker
            prefix="Watch"
            kind={watchKind}
            setKind={setWatchKind}
            mailbox={watchMailbox}
            setMailbox={setWatchMailbox}
          />
          <button
            type="button"
            onClick={addWatch}
            className="min-h-11 rounded-sm border border-border-strong bg-surface px-3"
          >
            Add watch
          </button>
        </div>
      </section>

      <section aria-labelledby="until-h" className="space-y-2">
        <h2 id="until-h" className="text-sm font-bold">
          Run until
        </h2>
        <p className="text-sm text-muted">
          Press Run and the machine stops after the first instruction that makes any of these true.
        </p>
        {conditions.length > 0 && (
          <ul className="space-y-1 text-sm">
            {conditions.map((c, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 rounded-sm border border-border px-2"
              >
                <span>
                  {metCondition === i && <span className="font-bold text-success">✓ Met: </span>}
                  Stop when {describeCondition(c)}
                </span>
                <button
                  type="button"
                  onClick={() => store.getState().removeCondition(i)}
                  aria-label={`Remove: stop when ${describeCondition(c)}`}
                  className="min-h-11 min-w-11 rounded-sm text-muted"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <TargetPicker
            prefix="Stop when"
            kind={condKind}
            setKind={setCondKind}
            mailbox={condMailbox}
            setMailbox={setCondMailbox}
          />
          <div>
            <label htmlFor={opId} className="block text-muted">
              Is
            </label>
            <select
              id={opId}
              value={op}
              onChange={(e) => setOp(e.target.value as CompareOp)}
              className="min-h-11 rounded-sm border border-border-strong bg-surface px-2"
            >
              {OPS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={valueId} className="block text-muted">
              Value
            </label>
            <input
              id={valueId}
              value={value}
              inputMode="numeric"
              onChange={(e) => setValue(e.target.value)}
              className="min-h-11 w-20 rounded-sm border border-border-strong bg-surface px-2"
            />
          </div>
          <button
            type="button"
            onClick={addCondition}
            className="min-h-11 rounded-sm border border-border-strong bg-surface px-3"
          >
            Add condition
          </button>
        </div>
      </section>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
