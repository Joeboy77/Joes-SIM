import type { Component } from "@joes-sim/engine";

export type Level = "beginner" | "technical";

/** A piece of a sentence. A `term` names a part of the machine, so views can link it to its highlight. */
export type Segment =
  { readonly text: string } | { readonly text: string; readonly term: Component };

export interface Narration {
  /** Message keys used, main message first. Tests use these to prove every message is reachable. */
  readonly keys: readonly string[];
  readonly segments: readonly Segment[];
  /** The whole sentence as plain text, for screen readers and copying. */
  readonly text: string;
}
