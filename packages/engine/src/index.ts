/**
 * @joes-sim/engine
 *
 * The engine is a set of pure functions: `step(state, options) -> { state, events }`.
 * It must never depend on React, the DOM or any browser API, so the same code runs in
 * the app, in tests, in a web worker and in the embed widget.
 *
 * Phase 0 only sets up the package. The classic machine arrives in Phase 1.
 */
export const ENGINE_VERSION = "0.0.0";
