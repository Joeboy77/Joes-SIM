/**
 * Runs a learner's program against a challenge's tests, in the browser (brief, 7.8). Nothing is
 * sent anywhere: this is for practice and self-checking only.
 */
import {
  Trace,
  assemble,
  createState,
  measure,
  run,
  type Diagnostic,
  type OutputItem,
  type StopReason,
} from "@joes-sim/engine";
import type { Challenge, ChallengeTest, ExpectedOutput, Targets } from "./types";

export interface TestResult {
  readonly index: number;
  readonly test: ChallengeTest;
  readonly pass: boolean;
  readonly outputs: readonly ExpectedOutput[];
  readonly reason: StopReason;
  readonly cycles: number;
  /** Where the outputs first differ from the expected ones, to open the simulator there. */
  readonly difference: {
    /** Position in the output list. */
    readonly index: number;
    /** Instructions completed when the wrong output appeared (or the run stopped). */
    readonly cycle: number;
  } | null;
  readonly explanation: string;
}

export interface ChallengeResult {
  /** Assembly errors; when there are any, no tests ran. */
  readonly errors: readonly Diagnostic[];
  readonly results: readonly TestResult[];
  readonly passed: boolean;
  /** Scores, when every test passes. */
  readonly scores: Targets | null;
}

export const TEST_STEP_LIMIT = 100_000;

const asExpected = (o: OutputItem): ExpectedOutput => (o.kind === "char" ? o.char : o.value);
const show = (o: ExpectedOutput) => (typeof o === "string" ? `'${o}'` : String(o));
const list = (os: readonly ExpectedOutput[]) => (os.length ? os.map(show).join(", ") : "nothing");

function explain(
  reason: StopReason,
  outputs: readonly ExpectedOutput[],
  expected: readonly ExpectedOutput[],
  pass: boolean,
): string {
  if (pass) return `Output ${list(outputs)}, as expected.`;
  const got = `It output ${list(outputs)}; the test expects ${list(expected)}.`;
  switch (reason) {
    case "waiting-input":
      return `The program asked for more inputs than the test gives. ${got}`;
    case "infinite-loop":
      return `The program got stuck in a loop that never ends. ${got}`;
    case "budget":
      return `The program was still running after ${TEST_STEP_LIMIT.toLocaleString("en")} steps. ${got}`;
    case "error":
      return `The program stopped on a mailbox that is not an instruction. ${got}`;
    default:
      return got;
  }
}

export function runChallenge(source: string, challenge: Challenge): ChallengeResult {
  const assembled = assemble(source, { dialect: challenge.dialect });
  const program = assembled.program;
  if (!program) {
    return {
      errors: assembled.diagnostics.filter((d) => d.severity === "error"),
      results: [],
      passed: false,
      scores: null,
    };
  }
  const results = challenge.tests.map((test, index): TestResult => {
    const initial = createState({
      memory: program.memory,
      inputs: [...test.inputs],
      dialect: challenge.dialect,
    });
    const r = run(initial, { maxSteps: TEST_STEP_LIMIT });
    const outputs = r.state.outputs.map(asExpected);
    const pass =
      r.reason === "halted" &&
      outputs.length === test.outputs.length &&
      outputs.every((o, i) => o === test.outputs[i]);
    let difference: TestResult["difference"] = null;
    if (!pass) {
      const at = outputs.findIndex((o, i) => o !== test.outputs[i]);
      const index = at >= 0 ? at : Math.min(outputs.length, test.outputs.length);
      difference = { index, cycle: cycleOfOutput(initial, index) ?? r.state.cycles };
    }
    return {
      index,
      test,
      pass,
      outputs,
      reason: r.reason,
      cycles: r.state.cycles,
      difference,
      explanation: explain(r.reason, outputs, test.outputs, pass),
    };
  });
  const passed = results.every((r) => r.pass);
  const size = measure(program);
  return {
    errors: [],
    results,
    passed,
    scores: passed
      ? {
          instructions: size.instructions,
          mailboxes: size.mailboxes,
          cycles: Math.max(0, ...results.map((r) => r.cycles)),
        }
      : null,
  };
}

/** The instruction count just after the n-th output (0-based) was produced, if it was. */
function cycleOfOutput(initial: ReturnType<typeof createState>, n: number): number | null {
  const trace = new Trace(initial);
  trace.syncTo(trace.maxRows);
  let seen = 0;
  for (const row of trace.rows) {
    if (row.output) {
      if (seen === n) return row.step;
      seen++;
    }
  }
  return null;
}

/** How a score compares with its target: at or under it is met. */
export function meetsTargets(scores: Targets, targets: Targets): Record<keyof Targets, boolean> {
  return {
    instructions: scores.instructions <= targets.instructions,
    cycles: scores.cycles <= targets.cycles,
    mailboxes: scores.mailboxes <= targets.mailboxes,
  };
}
