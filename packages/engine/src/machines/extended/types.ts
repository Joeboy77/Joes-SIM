/**
 * The extended machine's state (docs/specs/extended.md). Plain, serialisable data, never
 * mutated: arrays are shared between states until they change.
 */

/** A key that reaches the keyboard buffer when the machine has completed `cycle` cycles. */
export interface KeyPress {
  readonly cycle: number;
  readonly key: number;
}

export interface Devices {
  /** Console text, at most CONSOLE_ROWS lines of CONSOLE_COLUMNS characters. */
  readonly console: string;
  /** Key codes waiting to be read, oldest first. */
  readonly keyboard: readonly number[];
  /** 256 colours, 0 to 15, row by row. */
  readonly pixels: readonly number[];
  /** The pixel the next colour goes to. */
  readonly pixel: number;
  /** Instructions between timer interrupts; 0 when the timer is off. */
  readonly timerPeriod: number;
  /** Instructions left until the next tick. */
  readonly timerLeft: number;
  /** Lit segments of the three digits, left to right: bit 0 = segment a … bit 6 = segment g. */
  readonly segments: readonly number[];
  /** The seven-segment display shows a minus sign. */
  readonly minus: boolean;
  /** The last note played (1 to 88), or 0. */
  readonly note: number;
  /** Length of a note in tenths of a second. */
  readonly noteLength: number;
}

export type InterruptSource = "timer" | "keyboard";

export interface ExtendedState {
  /** Stack pointer: the top of the stack; 100 when it is empty. */
  readonly sp: number;
  /** Index register. */
  readonly x: number;
  /** Interrupts enabled. */
  readonly ie: boolean;
  /** Interrupt vector: where the handler starts. */
  readonly iv: number;
  readonly timerPending: boolean;
  readonly keyboardPending: boolean;
  /** What raised the last interrupt: 1 timer, 2 keyboard, 0 none yet (port 50). */
  readonly cause: number;
  /** The stack may not grow below this mailbox: the first one after the program. */
  readonly stackFloor: number;
  /** The second word of a two-word instruction. */
  readonly operand: number;
  /** Every key press of the run, in order; `keyIndex` is the next one to deliver. */
  readonly keys: readonly KeyPress[];
  readonly keyIndex: number;
  readonly devices: Devices;
}
