# Contributing to Joe's SIM

Thank you for helping. Joe's SIM is a learning tool first, so every change should make the
machine's behaviour easier to see and understand.

## Ground rules

- **The engine must be correct.** Write tests for engine behaviour before or alongside the code.
  A simulator that teaches wrong behaviour is worse than none.
- **Keep the engine pure.** `packages/engine` must not import React, Next.js or any browser API.
  A test enforces this.
- **No accounts, no tracking.** The core product never needs sign-up and never collects personal data.
- **Do not copy other simulators.** Build from the published LMC model. Do not copy code, layout,
  graphics or text from Peter Higginson's simulator or any other tool. All illustrations must be original.
- **Accessible by default.** Every control works with a keyboard, has a label, and never relies on
  colour alone.

## Workflow

1. Install Node.js 20.19+ (22 LTS recommended) and pnpm 9, then run `pnpm install`.
2. Make your change in small, focused commits with clear messages.
3. Before pushing, run:
   ```sh
   pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
   ```
4. Open a pull request describing what changed and why it helps learners.

## Recording decisions

When you make a design choice that someone might later question, add a short note in
`docs/decisions/` named `NNNN-short-title.md` with four headings: Context, Options, Choice, Reason.

## Specifications

Instruction semantics and dialect rules live in `docs/specs/`. Every rule must name its source.
If a rule cannot be confirmed from a public source, mark it **unconfirmed** and raise it for review
before relying on it.

## Code style

- TypeScript strict mode everywhere; no `any` in the engine.
- Prettier formats the code (`pnpm format`); ESLint must be clean.
- Prefer small modules with one clear job.

## Content

Lessons and challenges are licensed CC BY 4.0. By contributing content you agree to release it
under that licence; by contributing code you agree to release it under the MIT licence.
