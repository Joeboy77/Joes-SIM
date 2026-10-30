/**
 * Run-until conditions: "run until ACC = 0", "until mailbox 20 > 5", "until 3 outputs". Plain
 * data, so they can be posted to a web worker, and checked after every instruction.
 */
import { MEMORY_SIZE } from "./types";

export type ConditionTarget =
  | { readonly kind: "acc" }
  | { readonly kind: "pc" }
  | { readonly kind: "mailbox"; readonly address: number }
  | { readonly kind: "outputs" };

export type CompareOp = "==" | "!=" | "<" | "<=" | ">" | ">=";

export interface RunCondition {
  readonly target: ConditionTarget;
  readonly op: CompareOp;
  readonly value: number;
}

/** The parts of a machine a condition can look at. Both MachineState and the fast core fit. */
export interface ConditionView {
  readonly pc: number;
  readonly acc: number;
  readonly memory: readonly number[];
  readonly outputs: { readonly length: number };
}

export function conditionValue(target: ConditionTarget, view: ConditionView): number {
  switch (target.kind) {
    case "acc":
      return view.acc;
    case "pc":
      return view.pc;
    case "mailbox":
      return view.memory[target.address] ?? 0;
    case "outputs":
      return view.outputs.length;
  }
}

export function compare(a: number, op: CompareOp, b: number): boolean {
  switch (op) {
    case "==":
      return a === b;
    case "!=":
      return a !== b;
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    case ">":
      return a > b;
    case ">=":
      return a >= b;
  }
}

export function conditionMet(condition: RunCondition, view: ConditionView): boolean {
  return compare(conditionValue(condition.target, view), condition.op, condition.value);
}

const OP_WORDS: Record<CompareOp, string> = {
  "==": "is",
  "!=": "is not",
  "<": "is less than",
  "<=": "is at most",
  ">": "is more than",
  ">=": "is at least",
};

/** "the accumulator is 0", "mailbox 20 is more than 5", "there are at least 3 outputs". */
export function describeCondition(condition: RunCondition): string {
  const { target, op, value } = condition;
  const words = OP_WORDS[op];
  switch (target.kind) {
    case "acc":
      return `the accumulator ${words} ${value}`;
    case "pc":
      return `the program counter ${words} ${String(value).padStart(2, "0")}`;
    case "mailbox":
      return `mailbox ${String(target.address).padStart(2, "0")} ${words} ${value}`;
    case "outputs":
      return `the number of outputs ${words} ${value}`;
  }
}

/** True when the condition refers only to things that exist. */
export function isValidCondition(condition: RunCondition): boolean {
  if (!Number.isInteger(condition.value)) return false;
  if (condition.target.kind !== "mailbox") return true;
  const a = condition.target.address;
  return Number.isInteger(a) && a >= 0 && a < MEMORY_SIZE;
}
