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
import { decodeExt, type ExtDecoded } from "../machines/extended/semantics";
import { buildCfg, successors, type ControlFlowGraph } from "./cfg";

export type FindingCode =
  | "no-halt"
  | "runs-into-data"
  | "runs-past-end"
  | "uninitialised-read"
  | "unreachable-code"
  | "cannot-halt"
  | "not-enough-inputs"
  | "inputs-unused"
  // The extended machine.
  | "ret-outside-subroutine"
  | "call-without-ret"
  | "ei-without-vec"
  | "push-without-pop";

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
  const extended = program.machine === "extended";
  const multicore = program.machine === "multicore";
  // On the multicore machine each core starts at its own label.
  const entries = [
    program.labels.core0?.address ?? 0,
    ...[1, 2, 3].flatMap((i) => {
      const at = program.labels[`core${i}`]?.address;
      return at === undefined ? [] : [at];
    }),
  ];
  const cfg = buildCfg(program.memory, program.dialect, extended, { multicore, entries });
  const dialect = getDialect(program.dialect);
  const ext = program.memory.map((v) => (extended ? decodeExt(v) : null));
  // On the extended machine 4xx words are not classic instructions.
  const decoded = program.memory.map((v, a) => (ext[a] ? null : decode(v, dialect)));
  const reachableCode = range().filter((a) => cfg.reachable[a]);
  const operandOf = (a: number) => program.memory[(a + 1) % MEMORY_SIZE] as number;
  const storesTo = new Set(
    reachableCode.flatMap((a) => {
      const d = decoded[a];
      if (d?.mnemonic === "STA") return [d.address];
      return ext[a]?.mnemonic === "STX" ? [operandOf(a)] : [];
    }),
  );
  // Stores through a pointer or an index can reach any mailbox.
  const unknownStores = reachableCode.some((a) => ext[a]?.mnemonic === "STA");
  const usesInterrupts = reachableCode.some((a) => ext[a]?.mnemonic === "EI");
  const selfModifying = [...storesTo].some((a) => program.kinds[a] === "code" || cfg.reachable[a]);
  const lineOf = (a: number) => program.addressToLine[a] ?? undefined;
  const at = (a: number) => {
    const line = lineOf(a);
    return line === undefined ? { address: a } : { address: a, line };
  };
  const findings: Finding[] = [];

  // No HLT anywhere in the source.
  const hasHalt = program.statements.some((s) => s.mnemonic === "HLT");
  // A program driven by interrupts may run until it is stopped, so it needs no HLT.
  if (!hasHalt && program.size > 0 && !usesInterrupts) {
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
    if (unknownStores) break;
    const d = decoded[a];
    const read =
      d && (d.mnemonic === "LDA" || d.mnemonic === "ADD" || d.mnemonic === "SUB")
        ? { mnemonic: d.mnemonic, address: d.address }
        : ext[a]?.mnemonic === "LDX"
          ? { mnemonic: "LDX", address: operandOf(a) }
          : null;
    if (!read) continue;
    const target = read.address;
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
          ? `${read.mnemonic} on line ${lineOf(a)} reads mailbox ${pad(target)}, which is never given a value.`
          : `${read.mnemonic} on line ${lineOf(a)} reads a DAT that has no starting value and is never stored to.`,
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
  if (!selfModifying && !usesInterrupts) {
    findings.push(...cannotHalt(program.memory, program.dialect, extended, cfg, at, multicore));
  }

  if (options.inputs) findings.push(...inputChecks(program, cfg, decoded, options.inputs.length));

  if (extended) findings.push(...extendedChecks(program, ext, reachableCode, at));

  return findings;
}

/** Mistakes with subroutines, the stack and interrupts (docs/specs/extended.md). */
function extendedChecks(
  program: Program,
  ext: readonly (ExtDecoded | null)[],
  reachableCode: readonly number[],
  at: (a: number) => { address: number; line?: number },
): Finding[] {
  const findings: Finding[] = [];
  const memory = program.memory;
  const lineOf = (a: number) => program.addressToLine[a] ?? undefined;
  const is = (a: number, m: string) => ext[a]?.mnemonic === m && !ext[a]?.mode;
  const target = (a: number) => memory[(a + 1) % MEMORY_SIZE] as number;

  // Addresses reached from `start` without entering subroutines (CALL carries on after itself).
  const walk = (start: number): Set<number> => {
    const seen = new Set<number>();
    const stack = [start];
    while (stack.length) {
      const a = stack.pop() as number;
      if (seen.has(a)) continue;
      seen.add(a);
      for (const s of successors(memory, a, program.dialect, true)) {
        if (s.kind !== "call" && s.kind !== "interrupt") stack.push(s.to);
      }
    }
    return seen;
  };

  const main = walk(0);
  const strayRet = [...main].sort((x, y) => x - y).find((a) => is(a, "RET"));
  if (strayRet !== undefined) {
    findings.push({
      code: "ret-outside-subroutine",
      severity: "warning",
      ...at(strayRet),
      message: `The main program reaches RET on line ${lineOf(strayRet)} without a CALL.`,
      explanation:
        "RET takes a return address off the stack. Reached without a CALL, there is no return address, so the machine stops with a stack underflow, or jumps to whatever was pushed last.",
      hints: [
        "How does the Little Man get to this RET?",
        "The path from the start reaches RET without going through CALL.",
        "Reach the subroutine with CALL, and put HLT (or a branch) before it so the main program does not run into it.",
      ],
    });
  }

  const reported = new Set<number>();
  for (const a of reachableCode) {
    if (!is(a, "CALL")) continue;
    const t = target(a);
    if (reported.has(t)) continue;
    reported.add(t);
    const body = walk(t);
    if ([...body].some((b) => is(b, "RET"))) continue;
    findings.push({
      code: "call-without-ret",
      severity: "warning",
      ...at(a),
      message: `The subroutine called on line ${lineOf(a)} never reaches RET.`,
      explanation: `CALL saves a return address on the stack and goes to mailbox ${pad(t)}. Without RET the program never comes back, and the return address is left on the stack.`,
      hints: [
        "How does this subroutine get back to where it was called from?",
        `No path from mailbox ${pad(t)} reaches RET.`,
        "End the subroutine with RET.",
      ],
    });
  }

  const ei = reachableCode.find((a) => is(a, "EI"));
  if (ei !== undefined && !reachableCode.some((a) => is(a, "VEC"))) {
    findings.push({
      code: "ei-without-vec",
      severity: "warning",
      ...at(ei),
      message: `Interrupts are turned on (line ${lineOf(ei)}) but VEC never says where the handler is.`,
      explanation:
        "When a device interrupts, the machine runs the handler at the interrupt vector. Without VEC the vector is 00, so an interrupt restarts the program from the top.",
      hints: [
        "Where should the machine go when the timer or keyboard interrupts?",
        "VEC sets the address of the interrupt handler.",
        "Add VEC with the handler's label before EI.",
      ],
    });
  }

  const push = reachableCode.find((a) => is(a, "PUSH"));
  if (push !== undefined && !reachableCode.some((a) => is(a, "POP"))) {
    findings.push({
      code: "push-without-pop",
      severity: "info",
      ...at(push),
      message: `PUSH on line ${lineOf(push)} puts values on the stack, but nothing takes them off with POP.`,
      explanation:
        "Values left on the stack fill it up, and a RET after a PUSH returns to the pushed value instead of the caller.",
      hints: [
        "What happens to the values you push?",
        "Every PUSH usually needs a matching POP.",
        "Add POP where you need the value back, before any RET.",
      ],
    });
  }
  return findings;
}

function cannotHalt(
  memory: readonly number[],
  dialect: Program["dialect"],
  extended: boolean,
  cfg: ControlFlowGraph,
  at: (a: number) => { address: number; line?: number },
  multicore: boolean,
): Finding[] {
  // Reverse search from every stopping point (HLT or an invalid instruction).
  const canStop = new Array<boolean>(MEMORY_SIZE).fill(false);
  const preds = Array.from({ length: MEMORY_SIZE }, () => [] as number[]);
  const stops: number[] = [];
  for (let a = 0; a < MEMORY_SIZE; a++) {
    if (!cfg.reachable[a]) continue;
    const succ = successors(memory, a, dialect, extended, multicore);
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
    const succ = successors(
      program.memory,
      a,
      program.dialect,
      program.machine === "extended",
      program.machine === "multicore",
    );
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
