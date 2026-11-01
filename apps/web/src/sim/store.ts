/**
 * The simulator's state and every action on it. The engine state is the single source of truth:
 * views read `state` and animate `lastStep`, but never change the machine themselves.
 *
 * Stepping records into a History for micro-step undo. Jumps on the timeline replay the program
 * deterministically from the start (fast: the engine runs ~50 million instructions a second),
 * which also works after an instant run, which records no history.
 */
import {
  History,
  Trace,
  analyse,
  assemble,
  createState,
  isValidInput,
  pressKey as enginePressKey,
  provideInput as engineProvideInput,
  run,
  step,
  DEFAULT_CACHE,
  DEFAULT_PIPELINE,
  type AssembleResult,
  type CacheConfig,
  type PipelineOptions,
  type Component,
  type ConditionTarget,
  type DialectId,
  type Finding,
  type InfiniteLoop,
  type MachineId,
  type MachineState,
  type MicroStep,
  type RunCondition,
  type StopReason,
  conditionMet,
} from "@joes-sim/engine";
import type { Level } from "@joes-sim/narration";
import { createStore } from "zustand/vanilla";
import { SPEEDS, type Speed } from "./speeds";

export type ViewMode = "datapath" | "story" | "flow" | "pipeline" | "cache";
export const VIEW_ORDER: readonly ViewMode[] = ["datapath", "story", "flow", "pipeline", "cache"];
export type Direction = "forward" | "back" | "jump";

export const STARTER_PROGRAM = `// Add two numbers
        INP          // read the first number
        STA first    // keep it in a mailbox
        INP          // read the second number
        ADD first    // add the first one to it
        OUT          // show the answer
        HLT          // stop
first   DAT
`;

export interface InputParse {
  readonly values: number[];
  readonly error: string | null;
}

export function parseInputs(text: string, dialect: DialectId): InputParse {
  const parts = text.split(/[\s,]+/).filter(Boolean);
  const values: number[] = [];
  for (const part of parts) {
    if (!/^[+-]?\d+$/.test(part)) return { values, error: `'${part}' is not a whole number.` };
    const value = Number.parseInt(part, 10);
    if (!isValidInput(value, dialect)) {
      return { values, error: `${part} is outside the range this dialect allows.` };
    }
    values.push(value);
  }
  return { values, error: null };
}

export interface SimState {
  source: string;
  dialect: DialectId;
  /** The classic machine, or the extended one with a stack, interrupts and devices. */
  machine: MachineId;
  inputText: string;
  inputError: string | null;
  assembled: AssembleResult;
  findings: Finding[];
  /** How many inputs were typed in before the run, as opposed to given while it waited. */
  typedInputs: number;

  /** The machine at cycle 0, with every input given so far (typed in advance or during the run). */
  initial: MachineState | null;
  state: MachineState | null;
  history: History | null;
  /** The micro-steps shown by the last action, to animate. */
  lastSteps: readonly MicroStep[];
  direction: Direction | null;
  /** Increases on every change of position, so views can restart animations. */
  stepId: number;
  /** Furthest cycle reached in this run, the end of the timeline. */
  maxCycle: number;
  /** One row per completed instruction, kept in step with `state`. Mutable: read `traceVersion`. */
  trace: Trace | null;
  traceVersion: number;

  breakpoints: number[];
  speed: Speed;
  playing: boolean;
  view: ViewMode;
  presentation: boolean;
  stopReason: StopReason | null;
  loop: InfiniteLoop | null;
  busy: boolean;
  /** Playback stopped only because INP needed a value (or WAIT a key); giving one resumes it. */
  resumeAfterInput: boolean;

  level: Level;
  heatmap: boolean;
  /** Values shown in the Watch panel. */
  watches: ConditionTarget[];
  /** Run until any of these is true. */
  conditions: RunCondition[];
  /** Which condition stopped the last run. */
  metCondition: number | null;
  /** A machine part the learner is pointing at in the narration, to highlight in the views. */
  hoverTerm: Component | null;
  /** Pipeline view settings. */
  pipeline: PipelineOptions;
  /** Cache view settings. */
  cache: CacheConfig;
}

export interface SimActions {
  setSource(source: string): void;
  setDialect(dialect: DialectId): void;
  setMachine(machine: MachineId): void;
  setInputText(text: string): void;
  reset(): void;
  stepMicro(): void;
  stepInstruction(): void;
  back(): void;
  backInstruction(): void;
  jumpToCycle(cycle: number): void;
  /** Runs from the start to a cycle, even past the end of the timeline (to open a step). */
  goToCycle(cycle: number): void;
  /** One playback tick. Returns false when playback should stop. */
  tick(): boolean;
  play(): void;
  /** Records a loop found by looking ahead, so playback stops when it has gone round once. */
  setLoop(loop: InfiniteLoop | null): void;
  setBusy(busy: boolean): void;
  pause(): void;
  setSpeed(speed: Speed): void;
  setView(view: ViewMode): void;
  togglePresentation(): void;
  toggleBreakpoint(address: number): void;
  provideInput(value: number): void;
  /** A key typed on the extended machine's keyboard. */
  pressKey(key: number): void;
  /** Applies the result of an instant run (from the worker or the main thread). */
  applyRun(state: MachineState, reason: StopReason, loop?: InfiniteLoop, condition?: number): void;
  setLevel(level: Level): void;
  toggleHeatmap(): void;
  addWatch(target: ConditionTarget): void;
  removeWatch(index: number): void;
  addCondition(condition: RunCondition): void;
  removeCondition(index: number): void;
  setHoverTerm(term: Component | null): void;
  setPipeline(options: Partial<PipelineOptions>): void;
  setCache(config: Partial<CacheConfig>): void;
}

export type SimStore = SimState & SimActions;

function build(source: string, dialect: DialectId, inputText: string, machine: MachineId) {
  const assembled = assemble(source, { dialect, machine });
  const parsed = parseInputs(inputText, dialect);
  const initial = assembled.program
    ? createState({
        memory: assembled.program.memory,
        inputs: parsed.values,
        dialect,
        machine,
        stackFloor: assembled.program.size,
      })
    : null;
  const findings = assembled.program ? analyse(assembled.program, { inputs: parsed.values }) : [];
  return {
    assembled,
    findings,
    typedInputs: parsed.values.length,
    trace: initial ? new Trace(initial) : null,
    traceVersion: 0,
    metCondition: null,
    inputError: parsed.error,
    initial,
    state: initial,
    history: initial ? new History(initial) : null,
    lastSteps: [],
    direction: null,
    maxCycle: 0,
    playing: false,
    stopReason: null,
    loop: null,
    resumeAfterInput: false,
  };
}

function stopReasonOf(state: MachineState): StopReason | null {
  if (state.status === "halted") return "halted";
  if (state.status === "error") return "error";
  if (state.status === "waiting-input") return "waiting-input";
  if (state.status === "waiting-interrupt") return "waiting-interrupt";
  return null;
}

export function createSimStore(
  initial: Partial<Pick<SimState, "source" | "dialect" | "inputText" | "machine">> = {},
) {
  const source = initial.source ?? STARTER_PROGRAM;
  const dialect = initial.dialect ?? "classic";
  const inputText = initial.inputText ?? "3, 4";
  const machine = initial.machine ?? "classic";

  return createStore<SimStore>()((set, get) => {
    /** Brings the trace up to the current state. Call after every change of position. */
    const syncTrace = () => {
      const { trace, state } = get();
      if (!trace || !state) return;
      trace.syncTo(state.cycles);
      if (trace.version !== get().traceVersion) set({ traceVersion: trace.version });
    };

    /** Records forward micro-steps from the current state. */
    const advance = (granularity: "micro" | "instruction") => {
      const { state, history, maxCycle, stepId } = get();
      if (!state || !history) return null;
      // Step one micro-step at a time, recording each so it can be undone on its own.
      const steps: MicroStep[] = [];
      let s = state;
      do {
        const r = step(s, { granularity: "micro" });
        if (r.state === s) break;
        if (r.steps[0]) {
          history.push(r.state, r.steps[0]);
          steps.push(r.steps[0]);
        }
        s = r.state;
      } while (granularity === "instruction" && s.stage !== 0 && s.status === "ready");
      if (s === state) {
        set({ stopReason: stopReasonOf(state) });
        return null;
      }
      set({
        state: s,
        lastSteps: steps,
        direction: "forward",
        stepId: stepId + 1,
        maxCycle: Math.max(maxCycle, s.cycles),
        stopReason: stopReasonOf(s),
        metCondition: null,
      });
      syncTrace();
      return s;
    };

    /** The state at a cycle, by replaying from the start. */
    const replay = (cycle: number): MachineState | null => {
      const { initial } = get();
      if (!initial) return null;
      return run(initial, { maxSteps: cycle, detectLoops: false }).state;
    };

    const moveTo = (state: MachineState, steps: readonly MicroStep[], direction: Direction) => {
      set({
        state,
        history: get().history ?? new History(state),
        lastSteps: steps,
        direction,
        stepId: get().stepId + 1,
        stopReason: stopReasonOf(state),
        metCondition: null,
      });
      syncTrace();
    };

    return {
      source,
      dialect,
      machine,
      inputText,
      ...build(source, dialect, inputText, machine),
      stepId: 0,
      breakpoints: [],
      speed: "normal",
      view: "datapath",
      presentation: false,
      busy: false,
      level: "beginner",
      heatmap: false,
      watches: [{ kind: "acc" }, { kind: "pc" }],
      conditions: [],
      hoverTerm: null,
      pipeline: DEFAULT_PIPELINE,
      cache: DEFAULT_CACHE,

      setSource(next) {
        const { dialect, inputText, machine, stepId } = get();
        set({ source: next, ...build(next, dialect, inputText, machine), stepId: stepId + 1 });
      },

      setDialect(next) {
        const { source, inputText, machine, stepId } = get();
        set({ dialect: next, ...build(source, next, inputText, machine), stepId: stepId + 1 });
      },

      setMachine(next) {
        const { source, dialect, inputText, stepId } = get();
        set({ machine: next, ...build(source, dialect, inputText, next), stepId: stepId + 1 });
      },

      setInputText(text) {
        const { source, dialect, machine, stepId } = get();
        set({ inputText: text, ...build(source, dialect, text, machine), stepId: stepId + 1 });
      },

      reset() {
        const { source, dialect, inputText, machine, stepId } = get();
        set({ ...build(source, dialect, inputText, machine), stepId: stepId + 1 });
      },

      stepMicro() {
        advance("micro");
      },

      stepInstruction() {
        advance("instruction");
      },

      back() {
        const { history, state } = get();
        if (!history || !state) return;
        if (history.position > history.start) {
          const undone = history.stepAt(history.position);
          moveTo(history.back() as MachineState, [undone], "back");
          return;
        }
        // History does not reach back this far (after a jump or an instant run): replay.
        if (state.microSteps === 0) return;
        const target = state.microSteps - 1;
        let s = replay(Math.max(0, state.cycles - (state.stage === 0 ? 1 : 0)));
        if (!s) return;
        for (let guard = 0; s.microSteps < target && guard < 16; guard++) {
          s = step(s, { granularity: "micro" }).state;
        }
        const last = step(s, { granularity: "micro" }).steps[0] ?? null;
        set({ history: new History(s) });
        moveTo(s, last ? [last] : [], "back");
      },

      backInstruction() {
        const { history, state } = get();
        if (!history || !state) return;
        const before = history.position;
        const target = history.backInstruction();
        if (target) {
          const undone: MicroStep[] = [];
          for (let p = before; p > history.position; p--) undone.push(history.stepAt(p));
          moveTo(target, undone.reverse(), "back");
          return;
        }
        if (state.cycles === 0 && state.stage === 0) return;
        const cycle = state.stage === 0 ? state.cycles - 1 : state.cycles;
        const s = replay(cycle);
        if (!s) return;
        set({ history: new History(s) });
        moveTo(s, [], "jump");
      },

      jumpToCycle(cycle) {
        const { maxCycle } = get();
        const target = Math.max(0, Math.min(cycle, maxCycle));
        const s = replay(target);
        if (!s) return;
        set({ history: new History(s), playing: false });
        moveTo(s, [], "jump");
      },

      goToCycle(cycle) {
        const s = replay(Math.max(0, cycle));
        if (!s) return;
        set({
          history: new History(s),
          playing: false,
          maxCycle: Math.max(get().maxCycle, s.cycles),
        });
        moveTo(s, [], "jump");
      },

      tick() {
        const { speed, breakpoints, loop, conditions } = get();
        const unit = SPEEDS[speed].unit;
        if (unit === "none") return false;
        const next = advance(unit);
        if (!next || next.status !== "ready") {
          const waiting = next?.status === "waiting-input" || next?.status === "waiting-interrupt";
          set({ playing: false, resumeAfterInput: waiting });
          return false;
        }
        if (next.stage === 0 && breakpoints.includes(next.pc)) {
          set({ playing: false, stopReason: "breakpoint" });
          return false;
        }
        const met = next.stage === 0 ? conditions.findIndex((c) => conditionMet(c, next)) : -1;
        if (met >= 0) {
          set({ playing: false, stopReason: "condition", metCondition: met });
          return false;
        }
        if (loop && next.stage === 0 && next.cycles >= loop.startCycle + loop.length) {
          set({ playing: false, stopReason: "infinite-loop" });
          return false;
        }
        return true;
      },

      play() {
        const { state, speed } = get();
        if (!state || state.status !== "ready") return;
        if (SPEEDS[speed].unit === "none") return;
        set({ playing: true, stopReason: null });
      },

      setLoop(loop) {
        set({ loop });
      },

      setBusy(busy) {
        set({ busy });
      },

      pause() {
        set({ playing: false });
      },

      setSpeed(next) {
        set({ speed: next, playing: get().playing && SPEEDS[next].unit !== "none" });
      },

      setView(view) {
        set({ view });
      },

      togglePresentation() {
        set({ presentation: !get().presentation });
      },

      toggleBreakpoint(address) {
        const { breakpoints } = get();
        set({
          breakpoints: breakpoints.includes(address)
            ? breakpoints.filter((b) => b !== address)
            : [...breakpoints, address].sort((a, b) => a - b),
        });
      },

      provideInput(value) {
        const { state, initial, resumeAfterInput, speed } = get();
        if (!state || !initial) return;
        const next = engineProvideInput(state, value);
        const inputs = [...initial.inputs, value];
        // Keep the starting state in step, so replays read this input too. Stepping back past
        // this point replays from the start, which includes the new input.
        get().trace?.setInputs(inputs);
        set({
          initial: { ...initial, inputs },
          state: next,
          history: new History(next),
          stopReason: null,
          resumeAfterInput: false,
          playing: resumeAfterInput && SPEEDS[speed].unit !== "none",
        });
        syncTrace();
      },

      pressKey(key) {
        const { state, initial, resumeAfterInput, speed } = get();
        if (!state?.ext || !initial?.ext) return;
        const next = enginePressKey(state, key);
        if (next === state) return;
        const keys = next.ext?.keys ?? [];
        // As with inputs, the starting state keeps every key, so replays type them too.
        get().trace?.setKeys(keys);
        const woke = state.status === "waiting-interrupt";
        set({
          initial: { ...initial, ext: { ...initial.ext, keys } },
          state: next,
          history: new History(next),
          stopReason: woke ? null : get().stopReason,
          resumeAfterInput: false,
          playing: get().playing || (woke && resumeAfterInput && SPEEDS[speed].unit !== "none"),
        });
        syncTrace();
      },

      applyRun(state, reason, loop, condition) {
        set({
          state,
          history: new History(state),
          lastSteps: [],
          direction: "jump",
          stepId: get().stepId + 1,
          maxCycle: Math.max(get().maxCycle, state.cycles),
          stopReason: reason,
          loop: loop ?? null,
          metCondition: condition ?? null,
          playing: false,
          busy: false,
        });
        syncTrace();
      },

      setLevel(level) {
        set({ level });
      },

      toggleHeatmap() {
        set({ heatmap: !get().heatmap });
      },

      addWatch(target) {
        const { watches } = get();
        if (watches.some((w) => JSON.stringify(w) === JSON.stringify(target))) return;
        set({ watches: [...watches, target] });
      },

      removeWatch(index) {
        set({ watches: get().watches.filter((_, i) => i !== index) });
      },

      addCondition(condition) {
        set({ conditions: [...get().conditions, condition] });
      },

      removeCondition(index) {
        set({ conditions: get().conditions.filter((_, i) => i !== index), metCondition: null });
      },

      setHoverTerm(term) {
        if (term !== get().hoverTerm) set({ hoverTerm: term });
      },

      setPipeline(options) {
        set({ pipeline: { ...get().pipeline, ...options } });
      },

      setCache(config) {
        set({ cache: { ...get().cache, ...config } });
      },
    };
  });
}

export type SimStoreApi = ReturnType<typeof createSimStore>;
