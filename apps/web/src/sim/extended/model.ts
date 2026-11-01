/**
 * What the extended machine's panels show, worked out from the trace so it is the same after
 * stepping, an instant run or a jump on the timeline. Pure functions, so they are easy to test.
 */
import { DIGIT_SEGMENTS, type Trace, type TraceRow } from "@joes-sim/engine";

/** What each value on the stack is, from the top of the stack (mailbox SP) down to 99. */
export type StackNote = "value" | "return address" | "saved PC" | "saved ACC" | "saved flag";

/**
 * The meaning of each stack entry, oldest first, by replaying pushes and pops from the trace.
 * Null when the trace no longer covers the run (past its row limit).
 */
export function stackNotes(rows: readonly TraceRow[], cycles: number): StackNote[] | null {
  if (rows.length < cycles) return null;
  const notes: StackNote[] = [];
  for (const r of rows.slice(0, cycles)) {
    if (!r.stack) continue;
    for (let i = 0; i < r.stack.popped; i++) notes.pop();
    if (r.mnemonic === "INT") notes.push("saved PC", "saved ACC", "saved flag");
    else if (r.mnemonic === "CALL") notes.push("return address");
    else for (let i = 0; i < r.stack.pushed; i++) notes.push("value");
  }
  return notes;
}

export interface InterruptSpan {
  readonly source: "timer" | "keyboard";
  /** The step (1-based row) where the interrupt was taken. */
  readonly start: number;
  /** The step of the RTI that ended the handler, or null if it is still running. */
  readonly end: number | null;
  /** Where the main program carries on. */
  readonly resume: number;
}

/** Every interrupt taken so far, with the stretch of steps its handler ran for. */
export function interruptSpans(trace: Trace | null, cycles: number): InterruptSpan[] {
  if (!trace) return [];
  const spans: {
    source: "timer" | "keyboard";
    start: number;
    end: number | null;
    resume: number;
  }[] = [];
  const open: number[] = [];
  for (const r of trace.rows.slice(0, cycles)) {
    if (r.mnemonic === "INT" && r.interrupt) {
      // The row's address is the instruction that was about to run: where the program resumes.
      spans.push({ source: r.interrupt, start: r.step, end: null, resume: r.address });
      open.push(spans.length - 1);
    } else if (r.mnemonic === "RTI") {
      const i = open.pop();
      const span = i === undefined ? undefined : spans[i];
      if (span) span.end = r.step;
    }
  }
  return spans;
}

/** The digits a seven-segment pattern shows, or "?" for a pattern that is not a digit. */
export function segmentText(segments: readonly number[], minus: boolean): string {
  const digits = segments.map((s) => {
    if (s === 0) return " ";
    const d = DIGIT_SEGMENTS.indexOf(s as (typeof DIGIT_SEGMENTS)[number]);
    return d === -1 ? "?" : String(d);
  });
  const text = digits.join("").trim();
  return `${minus ? "−" : ""}${text}`;
}

/** Key codes for keys the keyboard device understands, or null. */
export function keyCode(key: string): number | null {
  if (key === "Enter") return 10;
  if (key === "Backspace") return 8;
  if (key === "ArrowUp") return 1;
  if (key === "ArrowDown") return 2;
  if (key === "ArrowLeft") return 3;
  if (key === "ArrowRight") return 4;
  if (key.length === 1) {
    const code = key.charCodeAt(0);
    return code >= 32 && code <= 126 ? code : null;
  }
  return null;
}

/** A key code as text, for the keyboard buffer. */
export function keyName(code: number): string {
  switch (code) {
    case 10:
      return "Enter";
    case 8:
      return "Backspace";
    case 1:
      return "↑";
    case 2:
      return "↓";
    case 3:
      return "←";
    case 4:
      return "→";
    case 32:
      return "Space";
    default:
      return String.fromCharCode(code);
  }
}

/**
 * The pixel display's 16 colours. An original palette for Joe's SIM, chosen so neighbouring
 * colours are easy to tell apart. Colour 0 is black and 15 is white (docs/specs/extended.md).
 */
export const PALETTE: readonly { readonly name: string; readonly hex: string }[] = [
  { name: "black", hex: "#000000" },
  { name: "navy", hex: "#1f3fbf" },
  { name: "green", hex: "#1f9d3a" },
  { name: "teal", hex: "#138a8a" },
  { name: "red", hex: "#c62828" },
  { name: "purple", hex: "#7b2fbf" },
  { name: "brown", hex: "#8d5a2b" },
  { name: "light grey", hex: "#b8b8b8" },
  { name: "dark grey", hex: "#5a5a5a" },
  { name: "sky blue", hex: "#5b8cff" },
  { name: "lime", hex: "#6ee07a" },
  { name: "cyan", hex: "#5fe3e3" },
  { name: "pink", hex: "#ff6b8b" },
  { name: "lilac", hex: "#c49bff" },
  { name: "yellow", hex: "#ffe14d" },
  { name: "white", hex: "#ffffff" },
];

/** A short description of the display for screen readers. */
export function describeDisplay(pixels: readonly number[]): string {
  const lit = pixels.flatMap((c, i) => (c ? [{ i, c }] : []));
  if (lit.length === 0) return "Pixel display, 16 by 16: all black.";
  if (lit.length <= 6) {
    const list = lit
      .map(
        ({ i, c }) =>
          `row ${Math.floor(i / 16) + 1} column ${(i % 16) + 1} ${PALETTE[c]?.name ?? c}`,
      )
      .join("; ");
    return `Pixel display, 16 by 16: ${lit.length} pixel${lit.length === 1 ? "" : "s"} lit: ${list}.`;
  }
  return `Pixel display, 16 by 16: ${lit.length} of 256 pixels lit.`;
}
