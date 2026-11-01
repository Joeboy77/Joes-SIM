/**
 * Runs a learner's program against a challenge's tests, in the browser (brief, 7.8). Nothing is
 * sent anywhere: this is for practice and self-checking only.
 */
import {
  Trace,
  assemble,
  cachedAccesses,
  checkCache,
  memoryAccesses,
  schedulePipeline,
  simulateCache,
  type CacheConfig,
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
  /** For pipeline and cache challenges: whether the performance goal was met, and why. */
  readonly goal?: { readonly met: boolean; readonly explanation: string };
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
  /** The message of an extended machine error (stack overflow and so on). */
  error?: string,
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
      return error
        ? `The program stopped with an error: ${error} ${got}`
        : `The program stopped on a mailbox that is not an instruction. ${got}`;
    case "waiting-interrupt":
      return `The program was still waiting for a key when the test ran out of keys. ${got}`;
    default:
      return got;
  }
}

export interface RunChallengeOptions {
  /** The cache the learner chose, for cache challenges. */
  readonly cache?: CacheConfig;
}

export function runChallenge(
  source: string,
  challenge: Challenge,
  options: RunChallengeOptions = {},
): ChallengeResult {
  const machine = challenge.machine ?? "classic";
  const assembled = assemble(source, { dialect: challenge.dialect, machine });
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
      machine,
      stackFloor: program.size,
      keys: test.keys ?? [],
    });
    const r = run(initial, { maxSteps: TEST_STEP_LIMIT });
    const outputs = r.state.outputs.map(asExpected);
    const devices = r.state.ext?.devices;
    const lit = (devices?.pixels ?? []).flatMap((c, i) => (c ? [[i, c] as const] : []));
    const consoleOk = test.console === undefined || devices?.console === test.console;
    const pixelsOk =
      test.pixels === undefined || JSON.stringify(lit) === JSON.stringify(test.pixels);
    const pass =
      r.reason === "halted" &&
      consoleOk &&
      pixelsOk &&
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
      explanation: !consoleOk
        ? `The console shows ${JSON.stringify(devices?.console ?? "")}; the test expects ${JSON.stringify(test.console)}.`
        : !pixelsOk
          ? `The display has ${lit.length} pixel${lit.length === 1 ? "" : "s"} lit, not the ${test.pixels?.length ?? 0} the test expects in the right places and colours.`
          : explain(
              r.reason,
              outputs,
              test.outputs,
              pass,
              r.state.error?.code === "invalid-instruction" ? undefined : r.state.error?.message,
            ),
    };
  });
  const goal = results.every((r) => r.pass) ? checkGoal(challenge, program, options) : undefined;
  const passed = results.every((r) => r.pass) && (goal?.met ?? true);
  const size = measure(program);
  return {
    errors: [],
    results,
    ...(goal ? { goal } : {}),
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

/** The pipeline or cache goal, checked on every test once all of them pass. */
function checkGoal(
  challenge: Challenge,
  program: { memory: readonly number[]; size: number },
  options: RunChallengeOptions,
): ChallengeResult["goal"] {
  const states = challenge.tests.map((test) => {
    const initial = createState({
      memory: program.memory,
      inputs: [...test.inputs],
      dialect: challenge.dialect,
      machine: challenge.machine ?? "classic",
      stackFloor: program.size,
      keys: test.keys ?? [],
    });
    return { initial, final: run(initial, { maxSteps: TEST_STEP_LIMIT }).state };
  });
  if (challenge.pipeline) {
    const { maxStalls, ...settings } = challenge.pipeline;
    const stalls = states.map(({ initial, final }) => {
      const trace = new Trace(initial);
      trace.syncTo(final.cycles);
      return schedulePipeline(trace.rows, program.memory, settings).stalls.total;
    });
    const worst = Math.max(0, ...stalls);
    return {
      met: worst <= maxStalls,
      explanation:
        worst <= maxStalls
          ? `The pipeline stalls for ${worst} cycle${worst === 1 ? "" : "s"} at most: the goal is ${maxStalls} or fewer.`
          : `The pipeline stalls for ${worst} cycle${worst === 1 ? "" : "s"} on one test; the goal is ${maxStalls} or fewer. Look at the pipeline view to see where.`,
    };
  }
  if (challenge.cache) {
    const config = options.cache ?? challenge.cache.start;
    const problem = checkCache(config);
    if (problem) return { met: false, explanation: problem };
    const size = config.blockSize * config.sets * config.ways;
    if (size > challenge.cache.maxMailboxes) {
      return {
        met: false,
        explanation: `This cache holds ${size} mailboxes; the goal allows at most ${challenge.cache.maxMailboxes}.`,
      };
    }
    const rates = states.map(
      ({ initial, final }) =>
        simulateCache(cachedAccesses(memoryAccesses(initial, final.cycles), config), config).stats
          .hitRate,
    );
    const worst = Math.min(...rates);
    const pct = (r: number) => `${(r * 100).toFixed(1)}%`;
    return {
      met: worst >= challenge.cache.minHitRate,
      explanation: `The hit rate is ${pct(worst)}${rates.length > 1 ? " on the hardest test" : ""}; the goal is at least ${pct(challenge.cache.minHitRate)}.`,
    };
  }
  return undefined;
}
