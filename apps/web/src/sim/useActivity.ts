"use client";

import { useMemo } from "react";
import { useReducedMotion } from "motion/react";
import { activityOf } from "./activity";
import { useSimState } from "./SimProvider";
import { SPEEDS } from "./speeds";

/** The last action's activity, plus how long each animated transfer should take. */
export function useActivity() {
  const lastSteps = useSimState((s) => s.lastSteps);
  const direction = useSimState((s) => s.direction);
  const stepId = useSimState((s) => s.stepId);
  const speed = useSimState((s) => s.speed);
  const reduced = useReducedMotion() ?? false;
  const activity = useMemo(() => activityOf(lastSteps, direction), [lastSteps, direction]);
  // Stepping backwards animates in reverse only at slow speeds; otherwise it jumps (brief, Phase 2).
  const base = SPEEDS[speed].animation;
  const duration = direction === "back" && speed !== "slow" && speed !== "manual" ? 0 : base;
  return { activity, stepId, duration: reduced ? 0 : duration, reduced };
}
