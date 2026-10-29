# 0003: Design tokens and theming

## Context

The brief asks for design tokens as CSS variables, light, dark and high-contrast themes, Tailwind
configured to use them, and a contrast check.

## Options

- Tokens in a TypeScript object, generated into CSS.
- Tokens hand-written in one CSS file, read by tests.

## Choice

- `packages/ui/src/styles/tokens.css` is the single source of truth. Every raw token is prefixed
  `--sim-` so it never clashes with Tailwind's own `--color-*` and `--radius-*` variables.
- The app's `globals.css` maps tokens into Tailwind with `@theme inline`, so utilities such as
  `bg-surface` and `text-muted` follow the active theme.
- Themes are selected by `data-theme` on `<html>`. The default is "Match device", which follows
  `prefers-color-scheme` and picks high contrast when `prefers-contrast: more` is set.
- A small inline script sets the theme before first paint (no flash). A unit test runs that
  script against the TypeScript `resolveTheme` for every case, so the two cannot drift.
- `contrast.test.ts` checks every theme: text and status colours at least 4.5:1 on every
  background (7:1 in high contrast), borders and focus rings at least 3:1.
- Fonts: Atkinson Hyperlegible for text (designed for low-vision readers) and JetBrains Mono for
  code and numbers (clear 0/O and 1/l). Both are self-hosted at build time by `next/font`, so no
  request goes to Google at runtime.

## Reason

Teachers and contributors can read and edit one plain CSS file. The tests make it impossible to
ship a theme that fails WCAG contrast.
