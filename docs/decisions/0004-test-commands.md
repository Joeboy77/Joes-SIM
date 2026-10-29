# 0004: Test commands

## Context

The brief says `pnpm test` runs all tests. Browser tests need a production build and an installed
browser, which takes minutes rather than seconds.

## Options

- `pnpm test` runs unit and browser tests together.
- `pnpm test` runs unit tests; `pnpm test:e2e` runs browser tests; CI runs both.

## Choice

The second. `pnpm test` runs every Vitest suite in every package through Turborepo.
`pnpm test:e2e` builds the app and runs Playwright with axe-core. CI runs lint, type check, unit
tests and browser tests on every push.

## Reason

Fast unit tests get run often. Keeping browser tests separate stops them slowing the edit-test loop,
while CI still guarantees both pass.
