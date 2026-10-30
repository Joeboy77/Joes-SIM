/**
 * Turns the engine's micro-step events into sentences (brief, 7.1). It reads only events and the
 * state after them, never the engine's internals, so any machine that emits these events can be
 * narrated.
 */
import {
  formatValue,
  type Component,
  type EngineEvent,
  type MachineState,
  type MicroStep,
  type OutputItem,
} from "@joes-sim/engine";
import { en, type Catalogue, type MessageKey } from "./en";
import type { Level, Narration, Segment } from "./types";

export interface NarrateOptions {
  readonly level: Level;
  readonly catalogue?: Catalogue;
}

type Params = Readonly<Record<string, string | number>>;
type Part = readonly [MessageKey, Params];

const pad = (a: number) => String(a).padStart(2, "0");
const COMPONENTS = new Set<string>([
  "PC",
  "MAR",
  "MDR",
  "IR",
  "ACC",
  "MEMORY",
  "ALU",
  "CONTROL",
  "INPUT",
  "OUTPUT",
]);

function find<T extends EngineEvent["type"]>(
  events: readonly EngineEvent[],
  type: T,
): Extract<EngineEvent, { type: T }> | undefined {
  return events.find((e): e is Extract<EngineEvent, { type: T }> => e.type === type);
}

/** The event a micro-step always carries. Missing means the engine and narration disagree. */
function need<T extends EngineEvent["type"]>(
  events: readonly EngineEvent[],
  type: T,
): Extract<EngineEvent, { type: T }> {
  const e = find(events, type);
  if (!e) throw new Error(`Expected a ${type} event.`);
  return e;
}

/** Fills a message: `{name}` from params, `[[PC]]` from the catalogue's terms. */
function fill(
  template: string,
  params: Params,
  terms: Readonly<Record<Component, string>>,
): Segment[] {
  const out: Segment[] = [];
  let text = "";
  let last = 0;
  for (const m of template.matchAll(/\[\[(\w+)\]\]|\{(\w+)\}/g)) {
    text += template.slice(last, m.index);
    last = m.index + m[0].length;
    const [, term, param = ""] = m;
    if (term !== undefined) {
      if (!COMPONENTS.has(term)) throw new Error(`Unknown machine part [[${term}]].`);
      const component = term as Component;
      if (text) out.push({ text });
      text = "";
      out.push({ text: terms[component], term: component });
    } else {
      const value = params[param];
      if (value === undefined) throw new Error(`Missing value {${param}} in "${template}".`);
      text += String(value);
    }
  }
  text += template.slice(last);
  if (text) out.push({ text });
  return out;
}

function compose(parts: readonly Part[], options: NarrateOptions): Narration {
  const catalogue = options.catalogue ?? en;
  const messages = catalogue.messages[options.level];
  const terms = catalogue.terms[options.level];
  const segments: Segment[] = [];
  parts.forEach(([key, params], i) => {
    if (i > 0) segments.push({ text: " " });
    segments.push(...fill(messages[key], params, terms));
  });
  // Join neighbouring plain text so screen readers and tests see whole phrases.
  const merged: Segment[] = [];
  for (const s of segments) {
    const prev = merged.at(-1);
    if (prev && !("term" in prev) && !("term" in s))
      merged[merged.length - 1] = { text: prev.text + s.text };
    else merged.push(s);
  }
  return {
    keys: parts.map(([key]) => key),
    segments: merged,
    text: merged.map((s) => s.text).join(""),
  };
}

const toChar = (item: OutputItem) => (item.kind === "char" ? item.char : String(item.value));

/** Suffixes for a wrapped result and a change of the negative flag. */
function suffixes(events: readonly EngineEvent[]): Part[] {
  const parts: Part[] = [];
  const alu = find(events, "alu");
  if (alu?.wrapped) parts.push(["suffix-wrapped", { raw: alu.raw, result: alu.result }]);
  const flag = find(events, "flag-change");
  if (flag) parts.push([flag.value ? "suffix-flag-set" : "suffix-flag-cleared", {}]);
  return parts;
}

function branchKey(
  prefix: "branch" | "summary",
  e: Extract<EngineEvent, { type: "branch" }>,
  after: MachineState,
): MessageKey {
  if (e.mnemonic === "BRA") return `${prefix}-BRA`;
  if (e.mnemonic === "BRZ") {
    if (e.taken) return `${prefix}-BRZ-taken`;
    return after.acc === 0 ? `${prefix}-BRZ-flag` : `${prefix}-BRZ-not-taken`;
  }
  if (!e.taken) return `${prefix}-BRP-not-taken`;
  return after.acc === 0 ? `${prefix}-BRP-zero` : `${prefix}-BRP-taken`;
}

/** One sentence for one micro-step. */
export function narrateStep(
  step: MicroStep,
  after: MachineState,
  options: NarrateOptions,
): Narration {
  const ev = step.events;
  const parts = ((): Part[] => {
    switch (step.op) {
      case "fetch-address":
        return [["fetch-address", { address: pad(need(ev, "transfer").value) }]];
      case "fetch-read": {
        const read = need(ev, "memory-read");
        return [["fetch-read", { address: pad(read.address), value: formatValue(read.value) }]];
      }
      case "fetch-load-ir":
        return [["fetch-load-ir", { value: formatValue(after.ir) }]];
      case "fetch-increment":
        return [["fetch-increment", { value: pad(need(ev, "pc-increment").value) }]];
      case "decode": {
        const error = find(ev, "error");
        if (error) return [["decode-invalid", { instruction: formatValue(error.error.value) }]];
        const d = need(ev, "decode");
        const catalogue = options.catalogue ?? en;
        const meaning = fill(
          catalogue.messages[options.level][`meaning-${d.mnemonic}`],
          { address: pad(d.address) },
          catalogue.terms[options.level],
        )
          .map((s) => s.text)
          .join("");
        return [["decode", { instruction: formatValue(d.instruction), meaning }]];
      }
      case "operand-address":
        return [["operand-address", { address: pad(after.mar) }]];
      case "operand-read": {
        const read = need(ev, "memory-read");
        return [["operand-read", { address: pad(read.address), value: read.value }]];
      }
      case "alu": {
        const alu = need(ev, "alu");
        return [
          [
            alu.operation === "add" ? "alu-add" : "alu-sub",
            { a: alu.a, b: alu.b, result: alu.result },
          ],
          ...suffixes(ev),
        ];
      }
      case "load-acc":
        return [["load-acc", { value: after.acc }], ...suffixes(ev)];
      case "store-mdr":
        return [["store-mdr", { value: after.mdr }]];
      case "store-write": {
        const w = need(ev, "memory-write");
        return [["store-write", { value: w.value, address: pad(w.address), previous: w.previous }]];
      }
      case "branch": {
        const b = need(ev, "branch");
        return [
          [
            branchKey("branch", b, after),
            { target: pad(b.target), acc: after.acc, next: pad(after.pc) },
          ],
        ];
      }
      case "input": {
        const input = find(ev, "input");
        if (!input) return [["input-needed", {}]];
        return [["input", { value: input.value }], ...suffixes(ev)];
      }
      case "output": {
        const { item } = need(ev, "output");
        if (item.kind === "char") return [["output-char", { value: item.value, char: item.char }]];
        return [["output", { value: item.value }]];
      }
      case "halt":
        return [["halt", {}]];
    }
  })();
  return compose(parts, options);
}

/**
 * One sentence for a whole instruction, such as "The instruction is 512, so the Little Man loads
 * the value from mailbox 12 into the accumulator. The accumulator is now 42." Returns null when
 * the steps are not a whole instruction (for example, the end of one started earlier).
 */
export function narrateInstruction(
  steps: readonly MicroStep[],
  after: MachineState,
  options: NarrateOptions,
): Narration | null {
  const ev = steps.flatMap((s) => s.events);
  const error = find(ev, "error");
  if (error) {
    const { address, value } = error.error;
    return compose(
      [["summary-invalid", { address: pad(address), instruction: formatValue(value) }]],
      options,
    );
  }
  const d = find(ev, "decode");
  if (!d) return null;
  const instruction = formatValue(d.instruction);
  const address = pad(d.address);
  const acc = after.acc;
  if (d.mnemonic === "INP" && find(ev, "input-needed") && !find(ev, "input")) {
    return compose([["summary-INP-waiting", { instruction }]], options);
  }
  if (!find(ev, "instruction-complete")) return null;
  const parts = ((): Part[] => {
    switch (d.mnemonic) {
      case "LDA":
      case "STA":
      case "HLT":
      case "OUT":
        return [[`summary-${d.mnemonic}`, { instruction, address, acc }]];
      case "ADD":
      case "SUB": {
        const { a, b } = need(ev, "alu");
        return [[`summary-${d.mnemonic}`, { instruction, address, acc, a, b }]];
      }
      case "BRA":
      case "BRZ":
      case "BRP": {
        const b = need(ev, "branch");
        return [
          [
            branchKey("summary", b, after),
            { instruction, target: pad(b.target), acc, next: pad(after.pc) },
          ],
        ];
      }
      case "INP":
        return [["summary-INP", { instruction, value: need(ev, "input").value, acc }]];
      case "OTC": {
        const { item } = need(ev, "output");
        return [["summary-OTC", { instruction, acc, char: toChar(item) }]];
      }
    }
  })();
  return compose([...parts, ...suffixes(ev)], options);
}

/**
 * Narration for what the last action did: a single micro-step gets its own sentence; a whole
 * instruction gets one summary; anything else gets a sentence per micro-step.
 */
export function narrate(
  steps: readonly MicroStep[],
  after: MachineState,
  options: NarrateOptions,
): Narration[] {
  if (steps.length === 0) return [];
  if (steps.length > 1) {
    const whole = narrateInstruction(steps, after, options);
    if (whole) return [whole];
  }
  // Each micro-step is narrated against the final state; values that change later in the same
  // action come from the step's own events.
  return steps.map((s) => narrateStep(s, after, options));
}
