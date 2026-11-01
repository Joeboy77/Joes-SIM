/**
 * Mistake detectors that watch a run (brief, 7.6). They read the Trace and the machine's current
 * state, so they give the same answer however the learner got there. Static checks are in
 * `analysis/detectors.ts`.
 */
import type { Program } from "../assembler/types";
import type { InfiniteLoop } from "../core/run";
import type { MachineErrorCode, MachineState } from "../core/types";
import type { Trace, TraceRow } from "./trace";

export type RuntimeFindingCode =
  | "brp-on-zero"
  | "ran-data"
  | "input-ran-out"
  | "inputs-left-over"
  | "infinite-loop"
  | "invalid-instruction"
  // The extended machine.
  | "stack-overwritten"
  | "machine-error";

export interface RuntimeFinding {
  readonly code: RuntimeFindingCode;
  readonly severity: "error" | "warning" | "info";
  readonly line?: number;
  readonly address?: number;
  readonly message: string;
  readonly explanation: string;
  /** Nudge, pointer, exact cause. */
  readonly hints: readonly [string, string, string];
  /** Where to jump to see the cause: the machine just before that instruction ran. */
  readonly cause?: { readonly cycle: number; readonly label: string };
}

export interface RuntimeOptions {
  /** The assembled program, for line numbers and what each mailbox was written as. */
  readonly program?: Program | null;
  /** Inputs typed in before the run (not those given while it waited). */
  readonly inputsGiven?: number;
  /** A loop proven to repeat forever. */
  readonly loop?: InfiniteLoop | null;
}

const pad = (a: number) => String(a).padStart(2, "0");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Finds the mistakes this run has shown so far. Each code is reported once. */
export function detectRuntime(
  trace: Trace,
  state: MachineState,
  options: RuntimeOptions = {},
): RuntimeFinding[] {
  const { program } = options;
  const lineOf = (a: number) => program?.addressToLine[a] ?? undefined;
  const at = (a: number) => {
    const line = lineOf(a);
    return line === undefined ? { address: a } : { address: a, line };
  };
  const onLine = (a: number) => {
    const line = lineOf(a);
    return line === undefined ? `in mailbox ${pad(a)}` : `on line ${line}`;
  };
  const rows = trace.rows;
  const findings: RuntimeFinding[] = [];

  // The last row, before index `before`, that wrote to a mailbox.
  const lastWrite = (address: number, before: number): TraceRow | undefined => {
    for (let i = before - 1; i >= 0; i--) if (rows[i]?.write?.address === address) return rows[i];
    return undefined;
  };
  const beforeRow = (row: TraceRow) => ({ cycle: row.step - 1 });

  // BRP taken on a zero result straight after SUB: the classic "BRP skips on zero" mix-up.
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as TraceRow;
    const prev = rows[i - 1] as TraceRow;
    if (r.mnemonic !== "BRP" || !r.branch?.taken || r.acc !== 0 || prev.mnemonic !== "SUB") {
      continue;
    }
    findings.push({
      code: "brp-on-zero",
      severity: "info",
      ...at(r.address),
      message: `BRP ${onLine(r.address)} branched when the subtraction gave exactly 0.`,
      explanation:
        "BRP branches when the accumulator is zero or positive. Zero counts as positive, so BRP does not skip on zero. If you meant this, all is well.",
      hints: [
        "What does BRP do when the accumulator is exactly 0?",
        `At step ${r.step} the accumulator was 0 and BRP still branched.`,
        "To treat zero differently, test it first with BRZ, or subtract one more before BRP.",
      ],
      cause: { ...beforeRow(r), label: `Go to step ${r.step}, where BRP saw 0` },
    });
    break;
  }

  // Running a mailbox that the program wrote as data, or left empty.
  if (program) {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] as TraceRow;
      const kind = program.kinds[r.address];
      if (kind === "code") continue;
      const written = lastWrite(r.address, i);
      const cameFrom = rows[i - 1];
      const cause = written ?? cameFrom;
      findings.push({
        code: "ran-data",
        severity: "warning",
        ...at(r.address),
        message:
          kind === "data"
            ? `At step ${r.step} the Little Man ran the DAT ${onLine(r.address)} as an instruction.`
            : `At step ${r.step} the program ran past its end into empty mailbox ${pad(r.address)}.`,
        explanation: written
          ? `Mailbox ${pad(r.address)} was written by STA at step ${written.step}, then run as the instruction ${String(r.instruction).padStart(3, "0")}. If you built this instruction on purpose, you can ignore this.`
          : `Mailbox ${pad(r.address)} holds ${String(r.instruction).padStart(3, "0")}, which the machine treats as an instruction.`,
        hints: [
          "Should the Little Man ever reach this mailbox?",
          cameFrom
            ? `He got here from mailbox ${pad(cameFrom.address)} at step ${cameFrom.step}.`
            : "He got here at the very start of the program.",
          kind === "data"
            ? "Put HLT before your DAT lines, or branch around the data."
            : "Add HLT where the program should stop.",
        ],
        ...(cause
          ? {
              cause: {
                ...beforeRow(cause),
                label: written
                  ? `Go to step ${cause.step}, where this mailbox was written`
                  : `Go to step ${cause.step}, which led here`,
              },
            }
          : {}),
      });
      break;
    }
  }

  // Waiting for more input than was typed in.
  const given = options.inputsGiven ?? state.inputs.length;
  if (state.status === "waiting-input" && state.inputIndex >= given) {
    findings.push({
      code: "input-ran-out",
      severity: "info",
      ...at(state.currentAddress),
      message: `INP ${onLine(state.currentAddress)} asked for input number ${state.inputIndex + 1}, but only ${given} ${given === 1 ? "input was" : "inputs were"} typed in.`,
      explanation:
        "The machine waits until you give another value. If the program should not need it, a loop may be running more times than you expect.",
      hints: [
        "How many times does this INP run?",
        `It has already read ${plural(state.inputIndex, "value")}.`,
        "Type in all the inputs before running, or check the loop that leads back to this INP.",
      ],
    });
  }

  // Finished with inputs still in the tray.
  if (state.status === "halted" && state.inputIndex < state.inputs.length) {
    const left = state.inputs.length - state.inputIndex;
    findings.push({
      code: "inputs-left-over",
      severity: "info",
      message: `The program stopped with ${plural(left, "input")} never read.`,
      explanation: `It read ${plural(state.inputIndex, "value")} out of ${state.inputs.length}. Extra inputs stay in the input tray.`,
      hints: [
        "Did the program read every value you gave it?",
        `It stopped after reading ${plural(state.inputIndex, "value")}.`,
        "Remove the extra inputs, or check why the loop that reads them ended early.",
      ],
    });
  }

  if (options.loop) {
    const { loop } = options;
    findings.push({
      code: "infinite-loop",
      severity: "warning",
      ...at(loop.startAddress),
      message: `The program is stuck in a loop that started at step ${loop.startCycle + 1}, ${onLine(loop.startAddress)}.`,
      explanation: `Every ${plural(loop.length, "instruction")} the machine comes back to exactly the same state, so it can never stop.`,
      hints: [
        "Does anything change each time round the loop?",
        "Watch the accumulator and the mailboxes the loop tests: they repeat exactly.",
        "Make sure the value tested by BRZ or BRP changes each time, so the loop can end.",
      ],
      cause: {
        cycle: loop.startCycle,
        label: `Go to step ${loop.startCycle + 1}, where the loop began`,
      },
    });
  }

  // A store into the live part of the stack (extended machine).
  for (const r of rows) {
    const store = r.mnemonic === "STA" || r.mnemonic === "STX";
    if (!store || !r.write || r.sp === undefined || r.write.address < r.sp) continue;
    findings.push({
      code: "stack-overwritten",
      severity: "warning",
      ...at(r.address),
      message: `Mailbox ${pad(r.write.address)} is on the stack and was overwritten at step ${r.step}.`,
      explanation:
        "The stack grows down from mailbox 99, and everything from the stack pointer up holds values the program still needs: saved return addresses, or values it will POP. Storing there changes them.",
      hints: [
        `What is mailbox ${pad(r.write.address)} used for?`,
        `At step ${r.step} the stack pointer was ${pad(r.sp)}, so mailboxes ${pad(r.sp)} to 99 belonged to the stack.`,
        "Keep your data below the stack, or use fewer stack entries.",
      ],
      cause: { ...beforeRow(r), label: `Go to step ${r.step}, where the stack was overwritten` },
    });
    break;
  }

  if (state.status === "error" && state.error && state.error.code !== "invalid-instruction") {
    const { address, code, message } = state.error;
    const cameFrom = rows.at(-1);
    findings.push({
      code: "machine-error",
      severity: "error",
      ...at(address),
      message,
      explanation: ERROR_EXPLANATIONS[code as ExtErrorCode],
      hints: [
        `What was the instruction ${onLine(address)} trying to do?`,
        cameFrom
          ? `The instruction before it was in mailbox ${pad(cameFrom.address)}, at step ${cameFrom.step}.`
          : "It was the first instruction the program ran.",
        ERROR_FIXES[code as ExtErrorCode],
      ],
      ...(cameFrom
        ? { cause: { ...beforeRow(cameFrom), label: `Go to step ${cameFrom.step}, just before` } }
        : {}),
    });
  } else if (state.status === "error" && state.error) {
    const { address, value } = state.error;
    const written = lastWrite(address, rows.length);
    const cameFrom = rows.at(-1);
    const cause = written ?? cameFrom;
    findings.push({
      code: "invalid-instruction",
      severity: "error",
      ...at(address),
      message: state.error.message,
      explanation: written
        ? `STA wrote ${String(value).padStart(3, "0")} into mailbox ${pad(address)} at step ${written.step}, and the machine later tried to run it.`
        : `Mailbox ${pad(address)} holds ${String(value).padStart(3, "0")}, which is not an instruction.`,
      hints: [
        `How did the Little Man get to mailbox ${pad(address)}?`,
        cameFrom
          ? `The instruction before was in mailbox ${pad(cameFrom.address)}, at step ${cameFrom.step}.`
          : "It was the first mailbox the program ran.",
        "Make sure the program halts or branches before it reaches data.",
      ],
      ...(cause
        ? {
            cause: {
              ...beforeRow(cause),
              label: `Go to the step that caused this (step ${cause.step})`,
            },
          }
        : {}),
    });
  }

  return findings;
}

type ExtErrorCode = Exclude<MachineErrorCode, "invalid-instruction">;

const ERROR_EXPLANATIONS: Record<ExtErrorCode, string> = {
  "address-out-of-range":
    "Indirect and indexed addressing work out an address while the program runs. Here it came out outside 00 to 99, where there are no mailboxes.",
  "stack-overflow":
    "The stack grows down from mailbox 99 towards your program. One more value would have overwritten the program itself, so the machine stopped.",
  "stack-underflow": "POP, RET and RTI take a value off the stack, but the stack was empty.",
  "device-error":
    "GET and PUT talk to a device through a port. This port, or this value, does not work.",
  "wait-forever":
    "WAIT sleeps until a device interrupts, but interrupts were off, so nothing could ever wake the machine.",
};

const ERROR_FIXES: Record<ExtErrorCode, string> = {
  "address-out-of-range": "Check the pointer's value, or that X stays within the table.",
  "stack-overflow":
    "Look for a loop that keeps pushing or calling without taking values off, or recursion that never stops.",
  "stack-underflow": "Make every POP and RET match an earlier PUSH or CALL.",
  "device-error": "Check the port number and the range of values it takes on the reference page.",
  "wait-forever": "Turn interrupts on with EI (and set VEC) before WAIT.",
};
