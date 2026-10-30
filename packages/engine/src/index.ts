/**
 * @joes-sim/engine
 *
 * Pure TypeScript machines. `step(state, options) -> { state, events }` moves the machine; the
 * events drive every view. No React, no DOM, no browser APIs, so the same code runs in the app,
 * in tests, in a web worker and in the embed widget.
 */
export * from "./core";
export * from "./dialects";
export * from "./assembler";
export * from "./analysis";
export * from "./insight";
export * from "./machines";
export * from "./reference";

export const ENGINE_VERSION = "0.1.0";
