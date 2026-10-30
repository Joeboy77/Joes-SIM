/** Run speeds (brief, 6.3). Each says how the machine moves and how long animations last. */
export type Speed = "manual" | "slow" | "normal" | "fast" | "instant";

export interface SpeedInfo {
  readonly label: string;
  /** "micro": one micro-step per tick. "instruction": one instruction per tick. */
  readonly unit: "micro" | "instruction" | "none";
  /** Milliseconds between ticks while playing. */
  readonly interval: number;
  /** Milliseconds for one animated transfer. 0 means no movement, just a highlight. */
  readonly animation: number;
}

export const SPEEDS: Readonly<Record<Speed, SpeedInfo>> = {
  manual: { label: "Micro-step (manual)", unit: "none", interval: 0, animation: 650 },
  slow: { label: "Slow", unit: "micro", interval: 900, animation: 650 },
  normal: { label: "Normal", unit: "micro", interval: 320, animation: 260 },
  fast: { label: "Fast", unit: "instruction", interval: 60, animation: 0 },
  instant: { label: "Instant", unit: "none", interval: 0, animation: 0 },
};

export const SPEED_ORDER: readonly Speed[] = ["manual", "slow", "normal", "fast", "instant"];
