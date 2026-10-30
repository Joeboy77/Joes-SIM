"use client";

import { detectRuntime, type RuntimeFinding } from "@joes-sim/engine";
import { useMemo } from "react";
import { useSimState } from "./SimProvider";
import { useTrace } from "./useTrace";

/** Mistakes the run has shown so far, recomputed when the trace or the machine changes. */
export function useRuntimeFindings(): RuntimeFinding[] {
  const { trace, version } = useTrace();
  const state = useSimState((s) => s.state);
  const program = useSimState((s) => s.assembled.program);
  const typedInputs = useSimState((s) => s.typedInputs);
  const loop = useSimState((s) => s.loop);
  return useMemo(() => {
    if (!trace || !state) return [];
    return detectRuntime(trace, state, { program, inputsGiven: typedInputs, loop });
    // `version` changes whenever the mutable trace does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trace, version, state, program, typedInputs, loop]);
}
