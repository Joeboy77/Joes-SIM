# Joe's SIM

A free, open-source, browser-based environment for learning how computers work at the machine
level. It starts with the classic Little Man Computer (LMC) and grows, step by step, into stacks
and interrupts, pipelines, caches, multiple cores and a RISC-V bridge.

It is first used as the practice tool for DCIT 207 (Computer Organization and Architecture) at
the University of Ghana, Legon, and then for students, teachers and self-learners anywhere.

- **No accounts.** Open the site and start. Work saves on your device.
- **Offline and light.** Built to run well on low-end phones and slow connections.
- **Learning first.** Every screen answers: what is the machine doing right now, and why?

## Status

| Phase | What it delivers                                                                      | Status      |
| ----- | ------------------------------------------------------------------------------------- | ----------- |
| 0     | Foundation: monorepo, app shell, themes, tests, CI                                    | Done        |
| 1     | Engine, assembler and dialects                                                        | Done        |
| 2     | Core simulator interface                                                              | Done        |
| 3     | Understanding tools (narration, time travel, traces)                                  | Done        |
| 4     | Practice, lessons and saving                                                          | Done        |
| 5     | Sharing, offline, translation and public launch                                       | Not started |
| 6–10  | Extended machine, pipeline and cache, multicore, compiler, custom machines and RISC-V | Not started |

## Getting started

You need Node.js 20.19 or later (22 LTS recommended) and pnpm 9.

```sh
pnpm install
pnpm dev          # http://localhost:3000
```

| Command              | What it does                                                |
| -------------------- | ----------------------------------------------------------- |
| `pnpm dev`           | Run the web app in development mode                         |
| `pnpm build`         | Build every package and the web app                         |
| `pnpm test`          | Run all unit tests (Vitest)                                 |
| `pnpm test:coverage` | Run unit tests with coverage                                |
| `pnpm test:e2e`      | Build the app and run browser tests (Playwright + axe-core) |
| `pnpm lint`          | Lint every package                                          |
| `pnpm typecheck`     | Type-check every package                                    |
| `pnpm format`        | Format the code with Prettier                               |

Before the first `pnpm test:e2e`, install the browser once: `pnpm --filter @joes-sim/web exec playwright install chromium`.

## The engine

The engine in [`packages/engine`](packages/engine/) runs the classic Little Man Computer in three
dialects (Classic, Higginson-compatible and OCR). It steps by instruction or micro-step with events
for every register transfer, records history for stepping backwards, proves when a program can
never stop, and assembles with plain-language diagnostics. See [docs/specs](docs/specs/) for the
exact rules of each dialect.

## Repository layout

```
apps/web/            Next.js app: simulator (/sim), lessons (/learn), challenges, progress, embed
packages/engine/     Pure TypeScript machines, dialects, assembler, analysis. No UI, no browser APIs
packages/narration/  Engine events to plain-language sentences
packages/compiler/   Little Language to LMC compiler
packages/ui/         Shared React components and design tokens
packages/embed/      The <joes-sim> web component
packages/content/    Challenges, their test runner, and (later) teacher packs
docs/decisions/      One short note per design decision
docs/specs/          Instruction set and dialect specifications
```

## Themes and design tokens

Colours, spacing, radius, type and motion live in
[`packages/ui/src/styles/tokens.css`](packages/ui/src/styles/tokens.css) as CSS variables, with
light, dark and high-contrast themes. A unit test checks every theme against WCAG 2.2 contrast
ratios, and the browser tests run axe-core on every page in every theme.

## Licence

Code is released under the [MIT licence](LICENSE). Learning content (the challenges in
`packages/content` and the lessons in `apps/web/src/lessons/content`) is released under
[CC BY 4.0](packages/content/LICENSE).

Joe's SIM is built from the published Little Man Computer model. It does not copy code, layout,
graphics or text from any other simulator.
