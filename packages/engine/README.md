# @joes-sim/engine

The Joe's SIM engine: pure TypeScript, with no UI and no browser APIs. It runs the same way in the
app, in tests, in a web worker and in the embed widget.

```ts
import { assemble, createState, step, run, History, analyse } from "@joes-sim/engine";

const { ok, program, diagnostics } = assemble(source, { dialect: "classic" });
if (!program) showDiagnostics(diagnostics);

let state = createState({ memory: program.memory, inputs: [3, 4], dialect: "classic" });

// Watch it: one micro-step or one instruction at a time, with events for every view.
const { state: next, events, steps } = step(state, { granularity: "micro" });

// Or run it fast, with a budget, breakpoints and infinite-loop detection.
const { state: final, reason, loop } = run(state, { maxSteps: 1_000_000, breakpoints: [7] });

// Record a run to step backwards and scrub.
const history = new History(state);
history.push(next, steps[0]);
history.back();

// Static mistake detection with tiered hints.
const findings = analyse(program, { inputs: [3, 4] });
```

| Module          | What it holds                                                                   |
| --------------- | ------------------------------------------------------------------------------- |
| `src/core`      | State, events, `step`, `run` (with loop detection), `History`, shared semantics |
| `src/machines`  | The classic machine: micro-step version and fast run loop                       |
| `src/dialects`  | Classic, Higginson-compatible and OCR definitions                               |
| `src/assembler` | Two-pass assembler, diagnostics with fixes, source map, disassembler            |
| `src/analysis`  | Control-flow graph, static mistake detectors, metrics                           |
| `src/reference` | Reference programs with expected results for every dialect                      |

Specifications: [docs/specs](../../docs/specs/).

`pnpm test` runs more than 500 tests: unit, property-based (fast-check), every reference
program in every dialect, and a throughput test. The engine must run at least 1,000,000
instructions per second; it currently runs about 50 million. `pnpm test:coverage` enforces 95%
coverage.
