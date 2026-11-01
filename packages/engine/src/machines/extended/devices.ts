/**
 * The virtual devices, reached through ports with GET and PUT (docs/specs/extended.md). Pure
 * functions shared by the micro-step machine and the fast run loop.
 */
import type { Devices, ExtendedState, KeyPress } from "./types";

export const CONSOLE_COLUMNS = 32;
export const CONSOLE_ROWS = 12;
export const KEYBOARD_SIZE = 8;
export const DISPLAY_SIZE = 16;
export const PIXELS = DISPLAY_SIZE * DISPLAY_SIZE;
export const DEFAULT_NOTE_LENGTH = 2;
/** Highest address plus one: the stack is empty when SP equals this. */
export const STACK_TOP = 100;

export type DeviceName =
  "console" | "keyboard" | "display" | "timer" | "seven-segment" | "beeper" | "interrupts";

interface Port {
  readonly device: DeviceName;
  /** What the port does, for errors and the reference page. */
  readonly meaning: string;
  readonly read: boolean;
  readonly write: boolean;
  readonly min?: number;
  readonly max?: number;
}

export const PORTS: Readonly<Record<number, Port>> = {
  1: { device: "console", meaning: "show a character", read: false, write: true },
  2: { device: "keyboard", meaning: "the next key", read: true, write: false },
  3: { device: "keyboard", meaning: "keys waiting", read: true, write: false },
  10: { device: "display", meaning: "choose a pixel", read: false, write: true, min: 0, max: 255 },
  11: { device: "display", meaning: "pixel colour", read: true, write: true, min: 0, max: 15 },
  12: { device: "display", meaning: "fill the display", read: false, write: true, min: 0, max: 15 },
  20: { device: "timer", meaning: "timer period", read: false, write: true, min: 0, max: 999 },
  21: { device: "timer", meaning: "instructions to the next tick", read: true, write: false },
  30: {
    device: "seven-segment",
    meaning: "show a number",
    read: false,
    write: true,
    min: -999,
    max: 999,
  },
  31: {
    device: "seven-segment",
    meaning: "digit 1 segments",
    read: false,
    write: true,
    min: 0,
    max: 127,
  },
  32: {
    device: "seven-segment",
    meaning: "digit 2 segments",
    read: false,
    write: true,
    min: 0,
    max: 127,
  },
  33: {
    device: "seven-segment",
    meaning: "digit 3 segments",
    read: false,
    write: true,
    min: 0,
    max: 127,
  },
  40: { device: "beeper", meaning: "play a note", read: false, write: true, min: 0, max: 88 },
  41: { device: "beeper", meaning: "note length", read: false, write: true, min: 1, max: 20 },
  50: { device: "interrupts", meaning: "interrupt cause", read: true, write: false },
};

/** Segments lit for each digit, bit 0 = segment a … bit 6 = segment g. */
export const DIGIT_SEGMENTS = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f] as const;

export function createDevices(): Devices {
  return {
    console: "",
    keyboard: [],
    pixels: new Array<number>(PIXELS).fill(0),
    pixel: 0,
    timerPeriod: 0,
    timerLeft: 0,
    segments: [0, 0, 0],
    minus: false,
    note: 0,
    noteLength: DEFAULT_NOTE_LENGTH,
  };
}

export interface CreateExtendedOptions {
  readonly stackFloor?: number;
  readonly keys?: readonly KeyPress[];
}

export function createExtended(
  memory: readonly number[],
  options: CreateExtendedOptions = {},
): ExtendedState {
  let floor = options.stackFloor;
  if (floor === undefined) {
    floor = memory.length;
    while (floor > 0 && memory[floor - 1] === 0) floor--;
  }
  const keys = [...(options.keys ?? [])];
  keys.forEach((k, i) => {
    if (!isValidKey(k.key)) throw new RangeError(`Key code ${k.key} is not between 1 and 126.`);
    if (
      !Number.isInteger(k.cycle) ||
      k.cycle < 0 ||
      (i > 0 && k.cycle < (keys[i - 1] as KeyPress).cycle)
    ) {
      throw new RangeError("Key presses must be listed in cycle order, from cycle 0.");
    }
  });
  const ext: ExtendedState = {
    sp: STACK_TOP,
    x: 0,
    ie: false,
    iv: 0,
    timerPending: false,
    keyboardPending: false,
    cause: 0,
    stackFloor: floor,
    operand: 0,
    keys,
    keyIndex: 0,
    devices: createDevices(),
  };
  return deliverKeys(ext, 0).ext;
}

export function isValidKey(key: number): boolean {
  return Number.isInteger(key) && key >= 1 && key <= 126;
}

export type PortResult<T> =
  ({ readonly ok: true } & T) | { readonly ok: false; readonly message: string };

function checkPort(port: number, access: "read" | "write"): Port | string {
  const p = PORTS[port];
  if (!p) return `There is no device on port ${pad(port)}.`;
  if (access === "read" && !p.read) {
    return `Port ${pad(port)} (${p.device}: ${p.meaning}) can only be written with PUT.`;
  }
  if (access === "write" && !p.write) {
    return `Port ${pad(port)} (${p.device}: ${p.meaning}) can only be read with GET.`;
  }
  return p;
}

/** GET p: the value a port gives, and the state after reading it (reading a key removes it). */
export function readPort(
  ext: ExtendedState,
  port: number,
): PortResult<{ value: number; ext: ExtendedState; device: DeviceName }> {
  const p = checkPort(port, "read");
  if (typeof p === "string") return { ok: false, message: p };
  const d = ext.devices;
  const result = (value: number, devices: Devices = d) => ({
    ok: true as const,
    value,
    device: p.device,
    ext: devices === d ? ext : { ...ext, devices },
  });
  switch (port) {
    case 2: {
      const [key, ...rest] = d.keyboard;
      return key === undefined ? result(0) : result(key, { ...d, keyboard: rest });
    }
    case 3:
      return result(d.keyboard.length);
    case 11:
      return result(d.pixels[d.pixel] ?? 0);
    case 21:
      return result(d.timerLeft);
    default:
      return result(ext.cause);
  }
}

export interface WriteEffects {
  readonly ext: ExtendedState;
  readonly device: DeviceName;
  /** Pixels whose colour changed. */
  readonly pixels?: readonly number[];
  /** A note to play. */
  readonly beep?: { readonly note: number; readonly length: number };
}

/** PUT p: the state after sending a value to a port. */
export function writePort(
  ext: ExtendedState,
  port: number,
  value: number,
): PortResult<WriteEffects> {
  const p = checkPort(port, "write");
  if (typeof p === "string") return { ok: false, message: p };
  if (port === 1) {
    if (!(value === 10 || value === 12 || (value >= 32 && value <= 126))) {
      return {
        ok: false,
        message: `The console shows character codes 32 to 126, 10 (new line) and 12 (clear); ${value} is none of these.`,
      };
    }
  } else if (value < (p.min ?? -Infinity) || value > (p.max ?? Infinity)) {
    return {
      ok: false,
      message: `Port ${pad(port)} (${p.device}: ${p.meaning}) takes ${p.min} to ${p.max}; ${value} is outside that.`,
    };
  }
  const d = ext.devices;
  const done = (devices: Partial<Devices>, extra: Omit<WriteEffects, "ext" | "device"> = {}) => ({
    ok: true as const,
    device: p.device,
    ext: { ...ext, devices: { ...d, ...devices } },
    ...extra,
  });
  switch (port) {
    case 1:
      return done({ console: appendConsole(d.console, value) });
    case 10:
      return done({ pixel: value });
    case 11: {
      const changed = d.pixels[d.pixel] !== value;
      const pixels = changed ? d.pixels.slice() : d.pixels;
      if (changed) (pixels as number[])[d.pixel] = value;
      return done({ pixels, pixel: (d.pixel + 1) % PIXELS }, { pixels: changed ? [d.pixel] : [] });
    }
    case 12: {
      const changedPixels: number[] = [];
      d.pixels.forEach((c, i) => c !== value && changedPixels.push(i));
      return done(
        { pixels: changedPixels.length ? new Array<number>(PIXELS).fill(value) : d.pixels },
        { pixels: changedPixels },
      );
    }
    case 20:
      // The tick at the end of this PUT brings the countdown to `value`.
      return done({ timerPeriod: value, timerLeft: value === 0 ? 0 : value + 1 });
    case 30:
      return done({ segments: numberSegments(value), minus: value < 0 });
    case 31:
    case 32:
    case 33: {
      const segments = d.segments.slice();
      segments[port - 31] = value;
      return done({ segments, minus: false });
    }
    case 40:
      return done(
        { note: value },
        value > 0 ? { beep: { note: value, length: d.noteLength } } : {},
      );
    default:
      return done({ noteLength: value });
  }
}

/** The three digits of a number, right-aligned, with leading zeros left blank. */
export function numberSegments(value: number): number[] {
  const digits = String(Math.abs(value)).padStart(3, " ");
  return [...digits].map((c) => (c === " " ? 0 : (DIGIT_SEGMENTS[Number(c)] ?? 0)));
}

export function appendConsole(text: string, code: number): string {
  if (code === 12) return "";
  let next: string;
  if (code === 10) {
    next = `${text}\n`;
  } else {
    const lastLine = text.slice(text.lastIndexOf("\n") + 1);
    next = (lastLine.length >= CONSOLE_COLUMNS ? `${text}\n` : text) + String.fromCharCode(code);
  }
  const lines = next.split("\n");
  return lines.length > CONSOLE_ROWS ? lines.slice(-CONSOLE_ROWS).join("\n") : next;
}

/** Counts down one instruction. When the countdown reaches 0 a timer interrupt is raised. */
export function tickTimer(ext: ExtendedState): { ext: ExtendedState; fired: boolean } {
  const d = ext.devices;
  if (d.timerPeriod === 0) return { ext, fired: false };
  if (d.timerLeft > 1) {
    return { ext: { ...ext, devices: { ...d, timerLeft: d.timerLeft - 1 } }, fired: false };
  }
  return {
    ext: { ...ext, timerPending: true, devices: { ...d, timerLeft: d.timerPeriod } },
    fired: true,
  };
}

export interface Delivered {
  readonly key: number;
  readonly dropped: boolean;
}

/**
 * Moves scheduled keys into the keyboard buffer once `cycles` cycles have completed. With
 * `next`, delivers the next scheduled key whatever its cycle (WAIT skips idle time).
 */
export function deliverKeys(
  ext: ExtendedState,
  cycles: number,
  next = false,
): { ext: ExtendedState; delivered: Delivered[] } {
  let i = ext.keyIndex;
  const delivered: Delivered[] = [];
  let keyboard = ext.devices.keyboard;
  while (
    i < ext.keys.length &&
    ((ext.keys[i] as KeyPress).cycle <= cycles || (next && i === ext.keyIndex))
  ) {
    const { key } = ext.keys[i] as KeyPress;
    const dropped = keyboard.length >= KEYBOARD_SIZE;
    if (!dropped) keyboard = [...keyboard, key];
    delivered.push({ key, dropped });
    i++;
  }
  if (i === ext.keyIndex) return { ext, delivered };
  return {
    ext: {
      ...ext,
      keyIndex: i,
      keyboardPending: ext.keyboardPending || delivered.some((d) => !d.dropped),
      devices: { ...ext.devices, keyboard },
    },
    delivered,
  };
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}
