"use client";

import {
  Trace,
  disassembleWord,
  mailboxColumn,
  type Program,
  type TraceRow,
} from "@joes-sim/engine";
import { useId, useMemo, useState } from "react";
import { useSim, useSimState } from "../SimProvider";
import { useTrace } from "../useTrace";

type FixedColumn = "step" | "address" | "instruction" | "acc" | "pc" | "flag" | "input" | "output";

interface Column {
  readonly id: string;
  readonly label: string;
  /** Hidden in fill-in mode, for the learner to work out. */
  readonly fillable: boolean;
  readonly value: (row: TraceRow, index: number) => string;
}

const FIXED: { id: FixedColumn; label: string; fillable: boolean }[] = [
  { id: "step", label: "Step", fillable: false },
  { id: "address", label: "Mailbox", fillable: false },
  { id: "instruction", label: "Instruction", fillable: false },
  { id: "acc", label: "ACC", fillable: true },
  { id: "pc", label: "PC", fillable: true },
  { id: "flag", label: "Negative", fillable: true },
  { id: "input", label: "Input", fillable: false },
  { id: "output", label: "Output", fillable: true },
];
const DEFAULT_FIXED: FixedColumn[] = ["step", "instruction", "acc", "pc", "output"];
const MAX_SHOWN = 1000;
const FILL_ROWS = 200;

const pad = (a: number) => String(a).padStart(2, "0");

/** "STA first" rather than "STA 06", when the source used a label. */
function instructionText(row: TraceRow, program: Program | null): string {
  const d = disassembleWord(row.instruction, program?.dialect ?? "classic");
  if (d.kind !== "instruction" || d.address === undefined || !program) return d.text;
  const label = Object.entries(program.labels).find(([, v]) => v.address === d.address)?.[0];
  return label ? `${d.text.split(" ")[0]} ${label}` : d.text;
}

function buildColumns(
  fixed: readonly FixedColumn[],
  mailboxes: readonly number[],
  trace: Trace,
  program: Program | null,
): Column[] {
  const cols: Column[] = FIXED.filter((c) => fixed.includes(c.id)).map((c) => ({
    ...c,
    value: (row: TraceRow): string => {
      switch (c.id) {
        case "step":
          return String(row.step);
        case "address":
          return pad(row.address);
        case "instruction":
          return instructionText(row, program);
        case "acc":
          return String(row.acc);
        case "pc":
          return pad(row.pc);
        case "flag":
          return row.negative ? "yes" : "";
        case "input":
          return row.input === undefined ? "" : String(row.input);
        case "output":
          if (!row.output) return "";
          return row.output.kind === "char" ? row.output.char : String(row.output.value);
      }
    },
  }));
  for (const a of mailboxes) {
    const values = mailboxColumn(trace, a);
    const label = Object.entries(program?.labels ?? {}).find(([, v]) => v.address === a)?.[0];
    cols.push({
      id: `m${a}`,
      label: label ? `${label} (${pad(a)})` : `Mailbox ${pad(a)}`,
      fillable: true,
      value: (_row, i) => String(values[i] ?? 0),
    });
  }
  return cols;
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Answers count as equal when they are the same number ("7" and "007"), or the same text. */
function same(answer: string, expected: string) {
  const a = answer.trim();
  if (/^-?\d+$/.test(a) && /^-?\d+$/.test(expected)) return Number(a) === Number(expected);
  return a.toLowerCase() === expected.toLowerCase() || (expected === "" && a === "-");
}

/** The automatic trace table (brief, 7.3). */
export function TracePanel() {
  const store = useSim();
  const { trace: live } = useTrace();
  const state = useSimState((s) => s.state);
  const initial = useSimState((s) => s.initial);
  const program = useSimState((s) => s.assembled.program);
  const [fixed, setFixed] = useState<FixedColumn[]>(DEFAULT_FIXED);
  const dataMailboxes = useMemo(
    () =>
      program
        ? Object.values(program.labels)
            .map((v) => v.address)
            .filter((a) => program.kinds[a] === "data")
            .sort((x, y) => x - y)
            .slice(0, 3)
        : [],
    [program],
  );
  const [mailboxes, setMailboxes] = useState<number[] | null>(null);
  const chosen = mailboxes ?? dataMailboxes;
  const [fillIn, setFillIn] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [extra, setExtra] = useState("");
  const extraId = useId();

  // Fill-in mode traces the whole run up front, so the table can be filled before stepping.
  const whole = useMemo(() => {
    if (!fillIn || !initial) return null;
    const t = new Trace(initial, { maxRows: FILL_ROWS });
    t.syncTo(FILL_ROWS);
    return t;
  }, [fillIn, initial]);
  const trace = whole ?? live;
  useSimState((s) => s.traceVersion); // re-render as the live trace grows
  if (!trace || !state) {
    return <p className="text-sm text-muted">Fix the errors in your program to see its trace.</p>;
  }

  const columns = buildColumns(fixed, chosen, trace, program);
  const rows = trace.rows.slice(0, MAX_SHOWN);
  const current = state.cycles;

  const exportCsv = () => {
    const lines = [columns.map((c) => csvCell(c.label)).join(",")];
    trace.rows.forEach((r, i) => lines.push(columns.map((c) => csvCell(c.value(r, i))).join(",")));
    download("trace.csv", `${lines.join("\n")}\n`);
  };
  const print = () => {
    document.body.classList.add("printing-trace");
    window.print();
    document.body.classList.remove("printing-trace");
  };
  const score = () => {
    let right = 0;
    let total = 0;
    rows.forEach((r, i) =>
      columns
        .filter((c) => c.fillable)
        .forEach((c) => {
          // A cell that should stay empty only counts if the learner wrote something in it.
          const answer = answers[`${i}:${c.id}`] ?? "";
          const expected = c.value(r, i);
          if (expected === "" && answer.trim() === "") return;
          total++;
          if (same(answer, expected)) right++;
        }),
    );
    return { right, total };
  };
  const result = checked ? score() : null;

  const toggleFixed = (id: FixedColumn) =>
    setFixed((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  const addMailbox = () => {
    const byLabel = program?.labels[extra.trim()]?.address;
    const n = byLabel ?? Number.parseInt(extra, 10);
    if (Number.isInteger(n) && n >= 0 && n < 100 && !chosen.includes(n)) {
      setMailboxes([...chosen, n].sort((x, y) => x - y));
      setExtra("");
    }
  };

  return (
    <section aria-labelledby="trace-h" className="space-y-3">
      <div className="no-print space-y-2">
        <h2 id="trace-h" className="text-sm font-bold">
          Trace table
        </h2>
        <fieldset className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          <legend className="sr-only">Columns</legend>
          {FIXED.map((c) => (
            <label key={c.id} className="inline-flex min-h-11 items-center gap-1">
              <input
                type="checkbox"
                checked={fixed.includes(c.id)}
                onChange={() => toggleFixed(c.id)}
                className="size-5"
              />
              {c.label}
            </label>
          ))}
          {chosen.map((a) => (
            <label key={a} className="inline-flex min-h-11 items-center gap-1">
              <input
                type="checkbox"
                checked
                onChange={() => setMailboxes(chosen.filter((x) => x !== a))}
                className="size-5"
              />
              {columns.find((c) => c.id === `m${a}`)?.label}
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <div>
            <label htmlFor={extraId} className="block text-muted">
              Add a mailbox column (label or number)
            </label>
            <input
              id={extraId}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMailbox()}
              className="min-h-11 w-32 rounded-sm border border-border-strong bg-surface px-2"
            />
          </div>
          <button
            type="button"
            onClick={addMailbox}
            className="min-h-11 rounded-sm border border-border-strong bg-surface px-3"
          >
            Add column
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="min-h-11 rounded-sm border border-border-strong bg-surface px-3"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={print}
            className="min-h-11 rounded-sm border border-border-strong bg-surface px-3"
          >
            Print
          </button>
          <button
            type="button"
            aria-pressed={fillIn}
            onClick={() => {
              setFillIn(!fillIn);
              setAnswers({});
              setChecked(false);
            }}
            className={`min-h-11 rounded-sm border px-3 ${fillIn ? "border-accent bg-accent font-bold text-on-accent" : "border-border-strong bg-surface"}`}
          >
            Fill-in mode
          </button>
        </div>
        {fillIn && (
          <p className="text-sm text-muted">
            Work out the hidden values, as in an exam, then check your answers. Leave a cell empty
            when nothing goes there.
          </p>
        )}
      </div>

      <div
        className="print-area max-h-[28rem] overflow-auto rounded-md border border-border"
        tabIndex={0}
        aria-label="Trace table, scrollable"
      >
        <table className="w-full border-collapse font-mono text-sm">
          <caption className="sr-only">
            Trace table: one row per instruction{fillIn ? ", with values to fill in" : ""}.
          </caption>
          <thead className="sticky top-0 bg-surface-2">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  className="border-b border-border px-2 py-1 text-left font-sans"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-2 py-2 font-sans text-muted">
                  Step or run the program to fill the table.
                </td>
              </tr>
            )}
            {rows.map((r, i) => {
              const here = !fillIn && r.step === current;
              return (
                <tr
                  key={r.step}
                  aria-current={here ? "step" : undefined}
                  className={here ? "bg-surface-2 font-bold" : ""}
                >
                  {columns.map((c) => {
                    const expected = c.value(r, i);
                    if (c.id === "step" && !fillIn) {
                      // The step number jumps there (brief, 7.2: click any row to go back to it).
                      return (
                        <td key={c.id} className="border-b border-border px-1 py-0.5">
                          <button
                            type="button"
                            onClick={() => store.getState().jumpToCycle(r.step)}
                            aria-label={`Go to step ${r.step}`}
                            className="min-h-9 min-w-9 rounded-sm text-accent underline"
                          >
                            {r.step}
                          </button>
                        </td>
                      );
                    }
                    if (!fillIn || !c.fillable) {
                      return (
                        <td key={c.id} className="border-b border-border px-2 py-1">
                          {expected}
                        </td>
                      );
                    }
                    const key = `${i}:${c.id}`;
                    const answer = answers[key] ?? "";
                    const ok =
                      checked && !(expected === "" && answer.trim() === "")
                        ? same(answer, expected)
                        : null;
                    return (
                      <td key={c.id} className="border-b border-border px-1 py-0.5">
                        <input
                          aria-label={`${c.label}, step ${r.step}`}
                          value={answers[key] ?? ""}
                          onChange={(e) => {
                            setAnswers({ ...answers, [key]: e.target.value });
                            setChecked(false);
                          }}
                          aria-invalid={ok === false ? true : undefined}
                          className={`min-h-9 w-16 rounded-sm border bg-surface px-1 ${ok === false ? "border-danger border-2" : ok ? "border-success border-2" : "border-border-strong"}`}
                        />
                        {ok !== null && (
                          <span className={ok ? "text-success" : "text-danger"}>
                            {ok ? " ✓" : ` ✗ ${expected || "(empty)"}`}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {trace.rows.length > MAX_SHOWN && (
        <p className="text-sm text-muted">
          Showing the first {MAX_SHOWN} of {trace.rows.length} rows. Export CSV to get them all.
        </p>
      )}
      {trace.full && !fillIn && (
        <p className="text-sm text-muted">
          The trace stops at {trace.maxRows.toLocaleString("en")} steps.
        </p>
      )}
      {fillIn && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setChecked(true)}
            className="min-h-11 rounded-sm border border-accent bg-accent px-3 font-bold text-on-accent"
          >
            Check my answers
          </button>
          {result && (
            <p role="status">
              {result.right} of {result.total} correct
              {result.right === result.total ? ". Well done!" : "."}
            </p>
          )}
          {whole &&
            whole.rows.length > 0 &&
            state &&
            whole.rows.length < FILL_ROWS &&
            whole.rows.at(-1)?.mnemonic !== "HLT" && (
              <p className="text-muted">The table stops where the program needs more input.</p>
            )}
        </div>
      )}
    </section>
  );
}
