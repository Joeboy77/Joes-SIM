/**
 * Predict mode (brief, 7.7): before each instruction, ask what will happen. The answer comes from
 * running the instruction on a copy of the machine, so it is always what really happens.
 */
import { disassembleWord, step, type MachineState } from "@joes-sim/engine";
import type { PredictionKind } from "@/storage/progress";

export interface Question {
  readonly kind: PredictionKind;
  readonly prompt: string;
  readonly answer: number | boolean | string;
  readonly input: "number" | "yes-no" | "character";
  /** The instruction being asked about, as written. */
  readonly instruction: string;
}

const pad = (a: number) => String(a).padStart(2, "0");

export function questionFor(state: MachineState): Question | null {
  if (state.status !== "ready" || state.stage !== 0) return null;
  const word = state.memory[state.pc] ?? 0;
  const text = disassembleWord(word, state.dialect).text;
  const r = step(state, { granularity: "instruction" });
  const where = `mailbox ${pad(state.pc)} (${text})`;
  if (r.state.status === "error") {
    return {
      kind: "halt",
      prompt: `Will the machine stop at ${where}?`,
      answer: true,
      input: "yes-no",
      instruction: text,
    };
  }
  if (r.state.status === "waiting-input") return null; // needs an input the learner has not given
  const decode = r.events.find((e) => e.type === "decode");
  if (!decode || decode.type !== "decode") return null;
  switch (decode.mnemonic) {
    case "LDA":
    case "ADD":
    case "SUB":
    case "INP":
      return {
        kind: "acc",
        prompt: `After ${where}, what will the accumulator hold?`,
        answer: r.state.acc,
        input: "number",
        instruction: text,
      };
    case "BRZ":
    case "BRP": {
      const branch = r.events.find((e) => e.type === "branch");
      return {
        kind: "branch",
        prompt: `Will ${where} branch to mailbox ${pad(decode.address)}?`,
        answer: branch?.type === "branch" && branch.taken,
        input: "yes-no",
        instruction: text,
      };
    }
    case "BRA":
      return {
        kind: "pc",
        prompt: `After ${where}, which mailbox runs next?`,
        answer: r.state.pc,
        input: "number",
        instruction: text,
      };
    case "OUT":
      return {
        kind: "output",
        prompt: `What will ${where} output?`,
        answer: r.state.acc,
        input: "number",
        instruction: text,
      };
    case "OTC": {
      const out = r.state.outputs.at(-1);
      return {
        kind: "output",
        prompt: `What character will ${where} output?`,
        answer: out?.kind === "char" ? out.char : "",
        input: "character",
        instruction: text,
      };
    }
    case "STA":
      return {
        kind: "memory",
        prompt: `After ${where}, what will mailbox ${pad(decode.address)} hold?`,
        answer: r.state.memory[decode.address] ?? 0,
        input: "number",
        instruction: text,
      };
    case "HLT":
      return {
        kind: "halt",
        prompt: `Will the machine stop at ${where}?`,
        answer: true,
        input: "yes-no",
        instruction: text,
      };
  }
}

/** Numbers match when equal ("7" and "007"); characters match exactly. */
export function isCorrect(q: Question, given: string | boolean): boolean {
  if (typeof q.answer === "boolean") return given === q.answer;
  if (typeof given !== "string") return false;
  if (typeof q.answer === "number") {
    const t = given.trim();
    return /^[+-]?\d+$/.test(t) && Number(t) === q.answer;
  }
  return given === q.answer;
}

export function showAnswer(q: Question): string {
  if (typeof q.answer === "boolean") return q.answer ? "yes" : "no";
  if (typeof q.answer === "string") return `'${q.answer}'`;
  return q.kind === "pc" ? pad(q.answer) : String(q.answer);
}
