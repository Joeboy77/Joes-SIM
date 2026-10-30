"use client";

import { useSimState } from "./SimProvider";

/** The trace, re-read whenever it changes. The Trace object is mutable, so subscribe to its version. */
export function useTrace() {
  const trace = useSimState((s) => s.trace);
  const version = useSimState((s) => s.traceVersion);
  return { trace, version };
}
