/**
 * The extended machine's instructions and interrupt entry, one micro-step at a time
 * (docs/specs/extended.md). Classic instructions run through the classic micro-step machine,
 * which calls in here for 4xx instructions, interrupts and the end of every instruction.
 */
import type { Dialect } from "../../dialects/types";
import type { EngineEvent, MicroOp, Phase } from "../../core/events";
import { alu, flagAfterLoad } from "../../core/semantics";
import { MEMORY_SIZE, type MachineErrorCode, type MachineState } from "../../core/types";
import { flagEvent, micro, type Changes, type MicroResult } from "../classic/micro";
import { deliverKeys, pad, readPort, tickTimer, writePort } from "./devices";
import { INTERRUPT_STAGE, INTERRUPT_STEPS, extSteps, type ExtDecoded } from "./semantics";
import type { ExtendedState, InterruptSource } from "./types";

export function interruptPending(ext: ExtendedState): boolean {
  return ext.ie && (ext.timerPending || ext.keyboardPending);
}

const isAddress = (n: number) => Number.isInteger(n) && n >= 0 && n < MEMORY_SIZE;

/** Stops the machine during a micro-step. Changes made by earlier micro-steps stay. */
function fail(
  state: MachineState,
  phase: Phase,
  op: MicroOp,
  code: MachineErrorCode,
  message: string,
): MicroResult {
  const error = { code, message, address: state.currentAddress, value: state.ir };
  return {
    state: { ...state, status: "error", error, microSteps: state.microSteps + 1 },
    step: { phase, op, events: [{ type: "error", error }] },
  };
}

function overflow(state: MachineState, phase: Phase, op: MicroOp): MicroResult {
  const ext = state.ext as ExtendedState;
  return fail(
    state,
    phase,
    op,
    "stack-overflow",
    `The stack is full: pushing would overwrite mailbox ${pad(ext.sp - 1)}, which is part of the program.`,
  );
}

function underflow(state: MachineState, op: MicroOp): MicroResult {
  return fail(
    state,
    "execute",
    op,
    "stack-underflow",
    "The stack is empty, so there is nothing to take off it.",
  );
}

function notAddress(state: MachineState, op: MicroOp, what: string, value: number): MicroResult {
  return fail(
    state,
    "execute",
    op,
    "address-out-of-range",
    `${what} is ${value}, which is not a mailbox address (00 to 99).`,
  );
}

/** Pushes a value: SP goes down by one and the value is written there. */
function push(
  state: MachineState,
  value: number,
): { memory: number[]; ext: ExtendedState; events: EngineEvent[] } | null {
  const ext = state.ext as ExtendedState;
  const sp = ext.sp - 1;
  if (sp < ext.stackFloor || sp < 0) return null;
  const memory = state.memory.slice();
  const previous = memory[sp] ?? 0;
  memory[sp] = value;
  return {
    memory,
    ext: { ...ext, sp },
    events: [
      { type: "transfer", from: "SP", to: "MAR", value: sp },
      { type: "memory-write", address: sp, previous, value },
    ],
  };
}

/** One micro-step of interrupt entry (stages 100 to 104). */
export function interruptStep(state: MachineState): MicroResult {
  const ext = state.ext as ExtendedState;
  const index = state.stage - INTERRUPT_STAGE;
  const op = INTERRUPT_STEPS[index] as MicroOp;
  if (index === 0) {
    const source: InterruptSource = ext.timerPending ? "timer" : "keyboard";
    return micro(
      state,
      "interrupt",
      op,
      {
        currentAddress: state.pc,
        ext: {
          ...ext,
          ie: false,
          cause: source === "timer" ? 1 : 2,
          // The keyboard stays pending until its keys are read, so a handler that reads one key
          // runs again for the next.
          timerPending: source === "timer" ? false : ext.timerPending,
        },
      },
      [
        { type: "interrupt-enter", source, from: state.pc, handler: ext.iv },
        { type: "register-change", register: "IE", value: false },
      ],
    );
  }
  if (index <= 3) {
    const saves = (["PC", "ACC", "flag"] as const)[index - 1] ?? "flag";
    const value = saves === "PC" ? state.pc : saves === "ACC" ? state.acc : state.negative ? 1 : 0;
    const p = push(state, value);
    if (!p) return overflow(state, "interrupt", op);
    return micro(
      state,
      "interrupt",
      op,
      { memory: p.memory, mar: p.ext.sp, mdr: value, ext: p.ext },
      [
        ...p.events,
        {
          type: "stack-push",
          address: p.ext.sp,
          value,
          sp: p.ext.sp,
          reason: "interrupt",
          saves,
        },
      ],
    );
  }
  return micro(
    state,
    "interrupt",
    op,
    { pc: ext.iv },
    [{ type: "transfer", from: "IV", to: "PC", value: ext.iv }],
    { mnemonic: "INT" },
  );
}

/** One execute micro-step of an extended instruction. */
export function executeExt(
  state: MachineState,
  d: ExtDecoded,
  index: number,
  dialect: Dialect,
): MicroResult {
  const ext = state.ext as ExtendedState;
  const ops = extSteps(d);
  const op = ops[index] as MicroOp;
  const last = index === ops.length - 1;
  const done = (changes: Changes, events: EngineEvent[], extChanges?: Partial<ExtendedState>) =>
    micro(
      state,
      "execute",
      op,
      extChanges ? { ...changes, ext: { ...(changes.ext ?? ext), ...extChanges } } : changes,
      events,
      last ? d : undefined,
    );
  const operandName = `The address in mailbox ${pad((state.currentAddress + 1) % MEMORY_SIZE)}`;

  switch (op) {
    case "operand-fetch-address":
      return done({ mar: state.pc }, [
        { type: "transfer", from: "PC", to: "MAR", value: state.pc },
      ]);
    case "operand-fetch-read": {
      const value = state.memory[state.mar] ?? 0;
      const next = (state.pc + 1) % MEMORY_SIZE;
      return done(
        { mdr: value, pc: next },
        [
          { type: "memory-read", address: state.mar, value },
          { type: "transfer", from: "MEMORY", to: "MDR", value },
          { type: "pc-increment", previous: state.pc, value: next },
        ],
        { operand: value },
      );
    }
    case "indirect-address":
      if (!isAddress(ext.operand)) return notAddress(state, op, operandName, ext.operand);
      return done({ mar: ext.operand }, [
        { type: "transfer", from: "MDR", to: "MAR", value: ext.operand },
      ]);
    case "indirect-read": {
      const value = state.memory[state.mar] ?? 0;
      return done({ mdr: value }, [
        { type: "memory-read", address: state.mar, value },
        { type: "transfer", from: "MEMORY", to: "MDR", value },
      ]);
    }
    case "operand-address": {
      if (d.mode === "indirect") {
        if (!isAddress(state.mdr)) {
          return notAddress(state, op, `The pointer in mailbox ${pad(ext.operand)}`, state.mdr);
        }
        return done({ mar: state.mdr }, [
          {
            type: "effective-address",
            mode: "indirect",
            operand: ext.operand,
            via: state.mdr,
            address: state.mdr,
          },
          { type: "transfer", from: "MDR", to: "MAR", value: state.mdr },
        ]);
      }
      if (!isAddress(ext.operand)) return notAddress(state, op, operandName, ext.operand);
      return done({ mar: ext.operand }, [
        { type: "transfer", from: "MDR", to: "MAR", value: ext.operand },
      ]);
    }
    case "index-add": {
      if (!isAddress(ext.operand)) return notAddress(state, op, operandName, ext.operand);
      const address = ext.operand + ext.x;
      if (!isAddress(address)) {
        return notAddress(state, op, `${ext.operand} + X (${ext.x})`, address);
      }
      return done({ mar: address }, [
        { type: "effective-address", mode: "indexed", operand: ext.operand, via: ext.x, address },
        { type: "transfer", from: "X", to: "MAR", value: address },
      ]);
    }
    case "operand-read": {
      const value = state.memory[state.mar] ?? 0;
      return done({ mdr: value }, [
        { type: "memory-read", address: state.mar, value },
        { type: "transfer", from: "MEMORY", to: "MDR", value },
      ]);
    }
    case "load-acc": {
      const negative = flagAfterLoad(state.mdr);
      return done({ acc: state.mdr, negative }, [
        { type: "transfer", from: "MDR", to: "ACC", value: state.mdr },
        ...flagEvent(state.negative, negative),
      ]);
    }
    case "alu": {
      const operation = d.mnemonic === "ADD" ? "add" : "sub";
      const r = alu(operation, state.acc, state.mdr, dialect);
      return done({ acc: r.result, negative: r.negative }, [
        { type: "transfer", from: "MDR", to: "ALU", value: state.mdr },
        {
          type: "alu",
          operation,
          a: state.acc,
          b: state.mdr,
          raw: r.raw,
          result: r.result,
          wrapped: r.wrapped,
        },
        { type: "transfer", from: "ALU", to: "ACC", value: r.result },
        ...flagEvent(state.negative, r.negative),
      ]);
    }
    case "store-mdr": {
      const value = d.mnemonic === "STX" ? ext.x : state.acc;
      return done({ mdr: value }, [
        { type: "transfer", from: d.mnemonic === "STX" ? "X" : "ACC", to: "MDR", value },
      ]);
    }
    case "store-write": {
      const previous = state.memory[state.mar] ?? 0;
      const memory = state.memory.slice();
      memory[state.mar] = state.mdr;
      return done({ memory }, [
        { type: "transfer", from: "MDR", to: "MEMORY", value: state.mdr },
        { type: "memory-write", address: state.mar, previous, value: state.mdr },
      ]);
    }
    case "load-x":
      return done(
        {},
        [
          { type: "transfer", from: "MDR", to: "X", value: state.mdr },
          { type: "register-change", register: "X", value: state.mdr },
        ],
        { x: state.mdr },
      );
    case "index-change": {
      const operation = d.mnemonic === "INX" ? "add" : "sub";
      const r = alu(operation, ext.x, 1, dialect);
      return done(
        {},
        [
          {
            type: "alu",
            operation,
            register: "X",
            a: ext.x,
            b: 1,
            raw: r.raw,
            result: r.result,
            wrapped: r.wrapped,
          },
          { type: "register-change", register: "X", value: r.result },
        ],
        { x: r.result },
      );
    }
    case "stack-push": {
      // PUSH saves ACC; CALL saves the return address, already in PC.
      const value = d.mnemonic === "PUSH" ? state.acc : state.pc;
      const p = push(state, value);
      if (!p) return overflow(state, "execute", op);
      return done({ memory: p.memory, mar: p.ext.sp, mdr: value, ext: p.ext }, [
        ...p.events,
        {
          type: "stack-push",
          address: p.ext.sp,
          value,
          sp: p.ext.sp,
          reason: d.mnemonic === "PUSH" ? "push" : "call",
        },
      ]);
    }
    case "stack-pop": {
      if (ext.sp >= MEMORY_SIZE) return underflow(state, op);
      const value = state.memory[ext.sp] ?? 0;
      const sp = ext.sp + 1;
      const events: EngineEvent[] = [
        { type: "transfer", from: "SP", to: "MAR", value: ext.sp },
        { type: "memory-read", address: ext.sp, value },
      ];
      if (d.mnemonic !== "RTI") {
        return done(
          { mar: ext.sp, mdr: value },
          [
            ...events,
            {
              type: "stack-pop",
              address: ext.sp,
              value,
              sp,
              reason: d.mnemonic === "POP" ? "pop" : "return",
            },
          ],
          { sp },
        );
      }
      // RTI takes back the flag, then ACC, then PC: the reverse of interrupt entry.
      const restores = (["flag", "ACC", "PC"] as const)[index] ?? "PC";
      const popped: EngineEvent = {
        type: "stack-pop",
        address: ext.sp,
        value,
        sp,
        reason: "interrupt-return",
        restores,
      };
      if (restores === "flag") {
        const negative = value !== 0;
        return done(
          { mar: ext.sp, mdr: value, negative },
          [...events, popped, ...flagEvent(state.negative, negative)],
          { sp },
        );
      }
      if (restores === "ACC") {
        return done(
          { mar: ext.sp, mdr: value, acc: value },
          [...events, popped, { type: "transfer", from: "MDR", to: "ACC", value }],
          { sp },
        );
      }
      if (!isAddress(value)) return notAddress(state, op, "The saved return address", value);
      return done(
        { mar: ext.sp, mdr: value, pc: value },
        [...events, popped, { type: "transfer", from: "MDR", to: "PC", value }],
        { sp },
      );
    }
    case "branch": {
      if (d.mnemonic === "CALL") {
        if (!isAddress(ext.operand)) return notAddress(state, op, operandName, ext.operand);
        return done({ pc: ext.operand }, [
          {
            type: "call",
            from: state.currentAddress,
            target: ext.operand,
            returnAddress: state.pc,
          },
          { type: "transfer", from: "MDR", to: "PC", value: ext.operand },
        ]);
      }
      // RET: the return address was popped into MDR.
      if (!isAddress(state.mdr)) return notAddress(state, op, "The return address", state.mdr);
      return done({ pc: state.mdr }, [
        { type: "return", from: state.currentAddress, target: state.mdr },
        { type: "transfer", from: "MDR", to: "PC", value: state.mdr },
      ]);
    }
    case "interrupt-enable": {
      const ie = d.mnemonic !== "DI";
      const events: EngineEvent[] = [{ type: "register-change", register: "IE", value: ie }];
      if (d.mnemonic === "RTI") events.push({ type: "interrupt-return", target: state.pc });
      return done({}, events, { ie });
    }
    case "set-vector":
      if (!isAddress(ext.operand)) return notAddress(state, op, operandName, ext.operand);
      return done(
        {},
        [
          { type: "transfer", from: "MDR", to: "IV", value: ext.operand },
          { type: "register-change", register: "IV", value: ext.operand },
        ],
        { iv: ext.operand },
      );
    case "wait":
      return waitStep(state, d);
    case "device-read": {
      const r = readPort(ext, ext.operand);
      if (!r.ok) return fail(state, "execute", op, "device-error", r.message);
      const negative = flagAfterLoad(r.value);
      return done({ acc: r.value, negative, ext: r.ext }, [
        { type: "device-read", device: r.device, port: ext.operand, value: r.value },
        { type: "transfer", from: "DEVICE", to: "ACC", value: r.value },
        ...flagEvent(state.negative, negative),
      ]);
    }
    default: {
      // device-write
      const r = writePort(ext, ext.operand, state.acc);
      if (!r.ok) return fail(state, "execute", op, "device-error", r.message);
      const events: EngineEvent[] = [
        { type: "transfer", from: "ACC", to: "DEVICE", value: state.acc },
        {
          type: "device-write",
          device: r.device,
          port: ext.operand,
          value: state.acc,
          ...(r.pixels ? { pixels: r.pixels } : {}),
        },
      ];
      if (r.beep) events.push({ type: "beep", ...r.beep });
      return done({ ext: r.ext }, events);
    }
  }
}

/**
 * WAIT: finishes when an interrupt is pending. Otherwise, with the timer running it idles (runs
 * again, so the timer keeps counting); with a key press scheduled it delivers that key; with
 * nothing that could wake it, the machine waits for a key (status `waiting-interrupt`).
 */
function waitStep(state: MachineState, d: ExtDecoded): MicroResult {
  let ext = state.ext as ExtendedState;
  const op: MicroOp = "wait";
  if (!ext.ie) {
    return fail(
      state,
      "execute",
      op,
      "wait-forever",
      "WAIT with interrupts off would wait forever: nothing could wake the machine. Use EI first.",
    );
  }
  const events: EngineEvent[] = [];
  if (!ext.timerPending && !ext.keyboardPending) {
    if (ext.devices.timerPeriod > 0) {
      return micro(
        state,
        "execute",
        op,
        { pc: state.currentAddress },
        [{ type: "wait", idle: true }],
        d,
      );
    }
    if (ext.keyIndex >= ext.keys.length) {
      return {
        state: { ...state, status: "waiting-interrupt" },
        step: { phase: "execute", op, events: [{ type: "wait", idle: true }] },
      };
    }
    const k = deliverKeys(ext, state.cycles, true);
    ext = k.ext;
    events.push(...keyEvents(k.delivered));
  }
  events.push({ type: "wait", idle: false });
  return micro(state, "execute", op, { ext }, events, d);
}

function keyEvents(delivered: readonly { key: number; dropped: boolean }[]): EngineEvent[] {
  const events: EngineEvent[] = delivered.map((k) => ({ type: "key", ...k }));
  if (delivered.some((k) => !k.dropped))
    events.push({ type: "interrupt-raised", source: "keyboard" });
  return events;
}

/**
 * The end of every instruction on the extended machine: the timer counts it (interrupt entry
 * does not count), and key presses due by now reach the keyboard buffer.
 */
export function completeExt(
  ext: ExtendedState,
  cycles: number,
  entry: boolean,
): { ext: ExtendedState; events: EngineEvent[] } {
  const events: EngineEvent[] = [];
  let next = ext;
  if (!entry) {
    const t = tickTimer(next);
    next = t.ext;
    if (t.fired) events.push({ type: "interrupt-raised", source: "timer" });
  }
  const k = deliverKeys(next, cycles);
  return { ext: k.ext, events: [...events, ...keyEvents(k.delivered)] };
}

/**
 * A key typed by the learner during a run. It is added to the run's key schedule, so replaying
 * gives the same run, and reaches the buffer now if the machine is between instructions or
 * waiting, otherwise at the end of the current instruction.
 */
export function pressKey(state: MachineState, key: number): MachineState {
  const ext = state.ext;
  if (!ext) throw new Error("Only the extended machine has a keyboard.");
  if (state.status === "halted" || state.status === "error") return state;
  const waiting = state.status === "waiting-interrupt";
  const cycle = state.cycles + (state.stage !== 0 ? 1 : 0);
  const keys = [...ext.keys, { cycle, key }];
  let next: ExtendedState = { ...ext, keys };
  if (state.stage === 0 || waiting) next = deliverKeys(next, cycle, waiting).ext;
  return { ...state, ext: next, status: waiting ? "ready" : state.status };
}
