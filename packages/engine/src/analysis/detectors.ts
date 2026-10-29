/**
 * Mistake detectors that work without running the program (brief, Section 7.6). Each finding
 * links to a line and carries three hints: a nudge, a clearer pointer, then the exact cause.
 *
 * Runtime checks (BRP on zero, reading past the inputs, infinite loops) live with the run loop.
 */
import type { Program } from "../assembler/types";
import { getDialect } from "../dialects/dialects";
import { decode } from "../core/semantics";
import { MEMORY_SIZE } from "../core/types";
import { buildCfg, successors, type ControlFlowGraph } from "./cfg";

export type FindingCode =
  | "no-halt"
  | "runs-into-data"
  | "runs-past-end"
  | "uninitialised-read"
  | "unreachable-code"
  | "cannot-halt"
  | "not-enough-inputs"
  | "inputs-unused";

export interface Finding {
  readonly code: FindingCode;
  readonly severity: "warning" | "info";
  /** 1-based source line, when the finding belongs to one. */
  readonly line?: number;
  readonly address?: number;
  readonly message: string;
  readonly explanation: string;
  /** Nudge, pointer, exact cause. Shown one at a time when the learner asks. */
  readonly hints: readonly [string, string, string];
}

export interface AnalyseOptions {
  /** Inputs the learner has provided, to check against what the program reads. */
  readonly inputs?: readonly number[];
}

const pad = (a: number) => String(a).padStart(2, "0");

export function analyse(program: Program, options: AnalyseOptions = {}): Finding[] {
  if (program.size === 0) return [];
  const cfg = buildCfg(program.memory, program.dialect);
  const dialect = getDialect(program.dialect);
  const decoded = program.memory.map((v) => decode(v, dialect));
  const reachableCode = range().filter((a) => cfg.reachable[a]);
  const storesTo = new Set(
    reachableCode.flatMap((a) => {
      const d = decoded[a];
      return d?.mnemonic === "STA" ? [d.address] : [];
    }),
  );
  const selfModifying = [...storesTo].some((a) => program.kinds[a] === "code" || cfg.reachable[a]);
  const lineOf = (a: number) => program.addressToLine[a] ?? undefined;
  const at = (a: number) => {
    const line = lineOf(a);
    return line === undefined ? { address: a } : { address: a, line };
  };
  const findings: Finding[] = [];

  // No HLT anywhere in the source.
  const hasHalt = program.statements.some((s) => s.mnemonic === "HLT");
  if (!hasHalt && program.size > 0) {
    findings.push({
      code: "no-halt",
      severity: "warning",
      message: "This program has no HLT, so nothing tells the Little Man to stop.",
      explanation:
        "Without HLT the machine keeps going past your last instruction and runs whatever is in the next mailboxes.",
      hints: [
        "How does your program finish?",
        "Look at what happens after the last instruction runs.",
        "Add HLT where the program should stop, before any DAT lines.",
      ],
    });
  }

  // Executing a DAT, or running off the end into empty mailboxes.
  const lastCode = Math.max(-1, ...range().filter((a) => program.kinds[a] === "code"));
  for (const a of reachableCode) {
    if (program.kinds[a] === "data" && !storesTo.has(a)) {
      const afterAll = a > lastCode;
      const line = lineOf(a);
      findings.push({
        code: "runs-into-data",
        severity: "warning",
        ...at(a),
        message: afterAll
          ? `The program runs past its last instruction into the DAT on line ${line}.`
          : `The DAT on line ${line} sits where the program will run it as an instruction.`,
        explanation: `Mailbox ${pad(a)} holds data, but nothing stops the Little Man reaching it, so he will treat ${String(program.memory[a]).padStart(3, "0")} as an instruction.`,
        hints: [
          "Follow the program from the top. Where does it go after the last instruction?",
          `Execution reaches mailbox ${pad(a)}, which is a DAT.`,
          afterAll
            ? "Put HLT (or a branch) before your DAT lines so the data is never run."
            : "Move this DAT below the HLT, or branch around it.",
        ],
      });
    } else if (program.kinds[a] === "empty") {
      findings.push({
        code: "runs-past-end",
        severity: "warning",
        address: a,
        message: `The program can run past its end into empty mailbox ${pad(a)}.`,
        explanation:
          "Empty mailboxes hold 000, which happens to mean HLT, so the program stops by luck rather than by design.",
        hints: [
          "Does every path through your program end with HLT?",
          `Execution can reach mailbox ${pad(a)}, which your program does not fill.`,
          "Add HLT where the program should stop, or check the branch that leads here.",
        ],
      });
    }
  }

  // Reading a mailbox that was never given a value.
  const readsReported = new Set<number>();
  for (const a of reachableCode) {
    const d = decoded[a];
    if (!d || !(d.mnemonic === "LDA" || d.mnemonic === "ADD" || d.mnemonic === "SUB")) continue;
    const target = d.address;
    if (readsReported.has(target) || storesTo.has(target)) continue;
    const kind = program.kinds[target];
    const statement = program.statements.find((s) => s.address === target);
    const noValue = kind === "empty" || (kind === "data" && statement?.operandText === undefined);
    if (!noValue) continue;
    readsReported.add(target);
    findings.push({
      code: "uninitialised-read",
      severity: "warning",
      ...at(a),
      message:
        kind === "empty"
          ? `${d.mnemonic} on line ${lineOf(a)} reads mailbox ${pad(target)}, which is never given a value.`
          : `${d.mnemonic} on line ${lineOf(a)} reads a DAT that has no starting value and is never stored to.`,
      explanation: `Mailbox ${pad(target)} will just hold 000. If you meant it to start with a value, write it after DAT (for example DAT 1), or STA into it first.`,
      hints: [
        `Where does the value in mailbox ${pad(target)} come from?`,
        "Nothing stores into this mailbox before it is read.",
        "Give the DAT a starting value, or STA a value into it before reading it.",
      ],
    });
  }

  // Code that can never run.
  let previousUnreachable = false;
  for (let a = 0; a < MEMORY_SIZE; a++) {
    const unreachable = program.kinds[a] === "code" && !cfg.reachable[a];
    if (unreachable && !previousUnreachable) {
      findings.push({
        code: "unreachable-code",
        severity: "warning",
        ...at(a),
        message: `The instruction on line ${lineOf(a)} can never run.`,
        explanation:
          "No path from the start of the program reaches it: the instruction before it always branches or halts, and nothing branches to it.",
        hints: [
          "Can the Little Man ever get to this line?",
          "Look at the instruction just before it, and at every branch target.",
          "Remove this code, or add a branch that leads to it.",
        ],
      });
    }
    previousUnreachable = unreachable;
  }

  // Parts of the program from which no path leads to a stop.
  if (!selfModifying) findings.push(...cannotHalt(program.memory, program.dialect, cfg, at));

  if (options.inputs) findings.push(...inputChecks(program, cfg, decoded, options.inputs.length));

  return findings;
}

function cannotHalt(
  memory: readonly number[],
  dialect: Program["dialect"],
  cfg: ControlFlowGraph,
  at: (a: number) => { address: number; line?: number },
): Finding[] {
  // Reverse search from every stopping point (HLT or an invalid instruction).
  const canStop = new Array<boolean>(MEMORY_SIZE).fill(false);
  const preds = Array.from({ length: MEMORY_SIZE }, () => [] as number[]);
  const stops: number[] = [];
  for (let a = 0; a < MEMORY_SIZE; a++) {
    if (!cfg.reachable[a]) continue;
    const succ = successors(memory, a, dialect);
    if (succ.length === 0) stops.push(a);
    succ.forEach((s) => (preds[s.to] as number[]).push(a));
  }
  const stack = [...stops];
  while (stack.length) {
    const a = stack.pop() as number;
    if (canStop[a]) continue;
    canStop[a] = true;
    stack.push(...(preds[a] as number[]));
  }
  const stuck = range().filter((a) => cfg.reachable[a] && !canStop[a]);
  if (stuck.length === 0) return [];
  const first = stuck[0] as number;
  const whole = !canStop[0];
  return [
    {
      code: "cannot-halt",
      severity: "warning",
      ...at(first),
      message: whole
        ? "This program can never stop: no path from the start reaches HLT."
        : `Once the program reaches mailbox ${pad(first)} it can never stop.`,
      explanation:
        "Every path from here loops back without reaching HLT, so the program would run forever.",
      hints: [
        "Is there a way out of this loop?",
        "Check that a BRZ or BRP can branch out of the loop, and that the value it tests changes.",
        "Add a conditional branch that leaves the loop and leads to HLT.",
      ],
    },
  ];
}

function inputChecks(
  program: Program,
  cfg: ControlFlowGraph,
  decoded: ReturnType<typeof decode>[],
  given: number,
): Finding[] {
  const reads = range().filter((a) => cfg.reachable[a] && decoded[a]?.mnemonic === "INP");
  if (reads.length === 0) {
    return given > 0
      ? [
          {
            code: "inputs-unused",
            severity: "info",
            message: `You gave ${given} input${given === 1 ? "" : "s"}, but the program never reads any.`,
            explanation: "Only INP takes a value from the input tray.",
            hints: [
              "Which instruction reads from the input tray?",
              "This program has no INP that can run.",
              "Add INP where the program should read a value, or remove the inputs.",
            ],
          },
        ]
      : [];
  }
  if (cfg.loops.length > 0) return []; // Counts depend on how often loops run; checked at runtime.

  // Without loops the graph is acyclic: count the fewest and most INPs on any path.
  const memo = new Map<number, [number, number]>();
  const count = (a: number): [number, number] => {
    const known = memo.get(a);
    if (known) return known;
    const here = decoded[a]?.mnemonic === "INP" ? 1 : 0;
    const succ = successors(program.memory, a, program.dialect);
    let result: [number, number] = [here, here];
    if (succ.length) {
      const sub = succ.map((s) => count(s.to));
      result = [here + Math.min(...sub.map((s) => s[0])), here + Math.max(...sub.map((s) => s[1]))];
    }
    memo.set(a, result);
    return result;
  };
  const [min, max] = count(0);
  if (given < min) {
    return [
      {
        code: "not-enough-inputs",
        severity: "warning",
        message: `The program reads ${min} input${min === 1 ? "" : "s"}, but only ${given} ${given === 1 ? "is" : "are"} given.`,
        explanation:
          "When INP runs and the input tray is empty, the machine stops and waits for a value.",
        hints: [
          "Count the INP instructions the program will run.",
          `It reads at least ${min} values.`,
          `Add ${min - given} more input${min - given === 1 ? "" : "s"}.`,
        ],
      },
    ];
  }
  if (given > max) {
    return [
      {
        code: "inputs-unused",
        severity: "info",
        message: `The program reads at most ${max} input${max === 1 ? "" : "s"}, so ${given - max} will never be used.`,
        explanation: "Extra inputs stay in the input tray when the program stops.",
        hints: [
          "Count the INP instructions the program will run.",
          `It reads at most ${max} values.`,
          "Remove the extra inputs, or add INP instructions to read them.",
        ],
      },
    ];
  }
  return [];
}

function range(): number[] {
  return Array.from({ length: MEMORY_SIZE }, (_, i) => i);
}
