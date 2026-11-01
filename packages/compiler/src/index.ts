/** @joes-sim/compiler: the Little Language to LMC (docs/specs/little-language.md). */
export * from "./compile";
export { KEYWORDS, parse } from "./parse";
export type { Compare, Condition, Expr, Stmt } from "./parse";
