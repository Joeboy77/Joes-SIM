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
  "SP",
  "X",
  "IV",
  "DEVICE",
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
const keyChar = (key: number) => (key === 10 ? "Enter" : String.fromCharCode(key));

/** A message with no values, as plain text: the name of a device, for example. */
function word(key: MessageKey, options: NarrateOptions): string {
  const catalogue = options.catalogue ?? en;
  return catalogue.messages[options.level][key];
}

/**
 * Suffixes for a wrapped result, a change of the negative flag, and (on the extended machine)
 * what happened at the end of the instruction: a timer tick, a key arriving, a note played.
 */
function suffixes(events: readonly EngineEvent[]): Part[] {
  const parts: Part[] = [];
  const alu = find(events, "alu");
  if (alu?.wrapped && alu.register !== "X") {
    parts.push(["suffix-wrapped", { raw: alu.raw, result: alu.result }]);
  }
  const flag = find(events, "flag-change");
  if (flag) parts.push([flag.value ? "suffix-flag-set" : "suffix-flag-cleared", {}]);
  const beep = find(events, "beep");
  if (beep) parts.push(["suffix-beep", { note: beep.note }]);
  for (const e of events) {
    if (e.type === "interrupt-raised" && e.source === "timer") parts.push(["suffix-timer", {}]);
    if (e.type === "key") {
      parts.push([e.dropped ? "suffix-key-dropped" : "suffix-key", { char: keyChar(e.key) }]);
    }
  }
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
  const error = step.op === "decode" ? undefined : find(ev, "error");
  if (error) return compose([["error", { message: error.error.message }]], options);
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
        const meaningKey = (
          d.mode ? `meaning-${d.mnemonic}-${d.mode}` : `meaning-${d.mnemonic}`
        ) as MessageKey;
        const meaning = fill(
          catalogue.messages[options.level][meaningKey],
          { address: pad(d.address) },
          catalogue.terms[options.level],
        )
          .map((s) => s.text)
          .join("");
        return [["decode", { instruction: formatValue(d.instruction), meaning }]];
      }
      case "operand-address":
        // Classic instructions take the address from the IR; extended ones from the MDR.
        if (need(ev, "transfer").from === "MDR") {
          return [["operand-address-ext", { address: pad(need(ev, "transfer").value) }]];
        }
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
        if (need(ev, "transfer").from === "X") return [["store-mdr-x", { value: after.mdr }]];
        return [["store-mdr", { value: after.mdr }]];
      case "store-write": {
        const w = need(ev, "memory-write");
        return [["store-write", { value: w.value, address: pad(w.address), previous: w.previous }]];
      }
      case "branch": {
        const call = find(ev, "call");
        if (call) return [["call", { target: pad(call.target) }]];
        const back = find(ev, "return");
        if (back) return [["return", { target: pad(back.target) }]];
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
      case "operand-fetch-address":
        return [["operand-fetch-address", { address: pad(need(ev, "transfer").value) }]];
      case "operand-fetch-read": {
        const read = need(ev, "memory-read");
        return [
          [
            "operand-fetch-read",
            {
              address: pad(read.address),
              value: read.value,
              next: pad(need(ev, "pc-increment").value),
            },
          ],
        ];
      }
      case "indirect-address":
        return [["indirect-address", { address: pad(need(ev, "transfer").value) }]];
      case "indirect-read": {
        const read = need(ev, "memory-read");
        return [["indirect-read", { address: pad(read.address), value: read.value }]];
      }
      case "index-add": {
        const ea = need(ev, "effective-address");
        return [["index-add", { x: ea.via, operand: pad(ea.operand), address: pad(ea.address) }]];
      }
      case "load-x":
        return [["load-x", { value: need(ev, "transfer").value }]];
      case "index-change": {
        const alu = need(ev, "alu");
        return [[alu.operation === "add" ? "index-up" : "index-down", { result: alu.result }]];
      }
      case "stack-push": {
        const p = need(ev, "stack-push");
        const params = { address: pad(p.address), value: p.value };
        if (p.reason === "interrupt") return [[`stack-save-${p.saves ?? "PC"}`, params]];
        return [[p.reason === "call" ? "stack-push-call" : "stack-push", params]];
      }
      case "stack-pop": {
        const p = need(ev, "stack-pop");
        const params = { address: pad(p.address), value: p.value, sp: p.sp };
        if (p.reason === "interrupt-return")
          return [[`stack-restore-${p.restores ?? "PC"}`, params]];
        return [[p.reason === "return" ? "stack-pop-return" : "stack-pop", params]];
      }
      case "interrupt-enable": {
        const back = find(ev, "interrupt-return");
        if (back) return [["interrupts-on-again", { target: pad(back.target) }]];
        return [[need(ev, "register-change").value ? "interrupts-on" : "interrupts-off", {}]];
      }
      case "set-vector":
        return [["set-vector", { address: pad(need(ev, "transfer").value) }]];
      case "wait":
        return [[need(ev, "wait").idle ? "wait-idle" : "wait-done", {}]];
      case "device-read": {
        const r = need(ev, "device-read");
        return [
          [
            "device-read",
            { port: pad(r.port), device: word(`name-${r.device}`, options), value: r.value },
          ],
        ];
      }
      case "device-write": {
        const w = need(ev, "device-write");
        return [
          [
            "device-write",
            { port: pad(w.port), device: word(`name-${w.device}`, options), value: w.value },
          ],
        ];
      }
      case "interrupt-accept": {
        const e = need(ev, "interrupt-enter");
        return [
          [
            "interrupt-enter",
            { source: word(`name-source-${e.source}`, options), from: pad(e.from) },
          ],
        ];
      }
      case "interrupt-jump":
        return [["interrupt-jump", { handler: pad(need(ev, "transfer").value) }]];
    }
  })();
  return compose([...parts, ...(isStepWithSuffixes(step) ? suffixes(ev) : [])], options);
}

/** Steps whose own message already covers the flag and wrapping get their suffixes there. */
function isStepWithSuffixes(step: MicroStep): boolean {
  return !["alu", "load-acc", "input"].includes(step.op);
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
    const { address, value, code, message } = error.error;
    if (code !== "invalid-instruction") {
      return compose([["summary-error", { instruction: formatValue(value), message }]], options);
    }
    return compose(
      [["summary-invalid", { address: pad(address), instruction: formatValue(value) }]],
      options,
    );
  }
  const d = find(ev, "decode");
  const entered = find(ev, "interrupt-enter");
  if (!d && entered && find(ev, "instruction-complete")) {
    return compose(
      [
        [
          "summary-INT",
          { source: word(`name-source-${entered.source}`, options), handler: pad(entered.handler) },
        ],
        ...suffixes(ev),
      ],
      options,
    );
  }
  if (!d) return null;
  const instruction = formatValue(d.instruction);
  const address = pad(d.address);
  const acc = after.acc;
  if (d.mnemonic === "INP" && find(ev, "input-needed") && !find(ev, "input")) {
    return compose([["summary-INP-waiting", { instruction }]], options);
  }
  if (d.mnemonic === "WAIT" && after.status === "waiting-interrupt") {
    return compose([["summary-WAIT-waiting", { instruction }]], options);
  }
  if (!find(ev, "instruction-complete")) return null;
  const ext = after.ext;
  const operand = pad(ext?.operand ?? 0);
  const x = ext?.x ?? 0;
  const parts = ((): Part[] => {
    if (d.mode) {
      const ea = need(ev, "effective-address");
      const key = `summary-${d.mnemonic}-${d.mode}` as MessageKey;
      return [
        [
          key,
          {
            instruction,
            pointer: pad(ea.operand),
            base: pad(ea.operand),
            x: ea.via,
            address: pad(ea.address),
            acc,
          },
        ],
      ];
    }
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
      case "PUSH":
        return [
          ["summary-PUSH", { instruction, acc, address: pad(need(ev, "stack-push").address) }],
        ];
      case "POP":
        return [["summary-POP", { instruction, acc }]];
      case "CALL": {
        const c = need(ev, "call");
        return [
          ["summary-CALL", { instruction, target: pad(c.target), back: pad(c.returnAddress) }],
        ];
      }
      case "RET":
        return [["summary-RET", { instruction, target: pad(need(ev, "return").target) }]];
      case "LDX":
      case "STX":
        return [[`summary-${d.mnemonic}`, { instruction, address: operand, x }]];
      case "INX":
      case "DEX":
        return [[`summary-${d.mnemonic}`, { instruction, x }]];
      case "EI":
      case "DI":
        return [[`summary-${d.mnemonic}`, { instruction }]];
      case "RTI":
        return [["summary-RTI", { instruction, target: pad(after.pc) }]];
      case "VEC":
        return [["summary-VEC", { instruction, address: operand }]];
      case "WAIT":
        return [
          [need(ev, "wait").idle ? "summary-WAIT-idle" : "summary-WAIT-done", { instruction }],
        ];
      case "GET": {
        const r = need(ev, "device-read");
        const device = word(`name-${r.device}`, options);
        return [["summary-GET", { instruction, port: pad(r.port), device, acc }]];
      }
      case "PUT": {
        const w = need(ev, "device-write");
        const device = word(`name-${w.device}`, options);
        return [["summary-PUT", { instruction, port: pad(w.port), device, acc }]];
      }
      case "TAS": {
        const read = ev.filter((e) => e.type === "memory-read").at(-1);
        const address = read?.type === "memory-read" ? pad(read.address) : "??";
        return [[acc === 0 ? "summary-TAS-free" : "summary-TAS-taken", { instruction, address }]];
      }
      case "INT":
        return [];
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
