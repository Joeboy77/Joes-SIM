/** Run speeds (brief, 6.3). Each says how the machine moves and how long animations last. */
export type Speed = "manual" | "slow" | "normal" | "fast" | "instant";

export interface SpeedInfo {
  readonly label: string;
  /** "micro": one micro-step per tick. "instruction": one instruction per tick. */
  readonly unit: "micro" | "instruction" | "none";
  /** Milliseconds between ticks while playing. */
  readonly interval: number;
  /** Milliseconds for one animated transfer (several play in turn). 0 means no movement, just a highlight. */
  readonly animation: number;
}

export const SPEEDS: Readonly<Record<Speed, SpeedInfo>> = {
  manual: { label: "Micro-step (manual)", unit: "none", interval: 0, animation: 650 },
  // An instruction is about 7 micro-steps: slow takes about 10 s for one, normal about 2.5 s, and
  // fast shows about 2 a second, its transfers played one after another in short hops.
  slow: { label: "Slow", unit: "micro", interval: 1500, animation: 1100 },
  normal: { label: "Normal", unit: "micro", interval: 360, animation: 280 },
  fast: { label: "Fast", unit: "instruction", interval: 450, animation: 60 },
  instant: { label: "Instant", unit: "none", interval: 0, animation: 0 },
};

export const SPEED_ORDER: readonly Speed[] = ["manual", "slow", "normal", "fast", "instant"];
