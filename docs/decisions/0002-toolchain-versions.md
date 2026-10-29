# 0002: Toolchain versions

## Context

At the start of the project (October 2026) the newest releases were TypeScript 7.0, Vitest 5 and
ESLint 10. The development machine runs Node.js 20.19.

## Options

- Use the newest releases and require Node.js 22+.
- Use the newest releases that work on Node.js 20.19 and with each other.

## Choice

- Node.js 20.19 minimum (`engines`), Node.js 22 LTS in CI and recommended in `.nvmrc`.
- TypeScript 5.9: typescript-eslint supports TypeScript up to 6.0, not 7.
- Vitest 4.1: Vitest 5 requires Node.js 22.
- ESLint 9: the Next.js lint plugins are proven on 9.
- Next.js 16, React 19, Tailwind CSS 4, Turborepo 2, pnpm 9.

## Reason

Everything must run on the machines contributors have today, and lint must type-check against the
TypeScript version we compile with. Revisit when the dev machine moves to Node.js 22 and
typescript-eslint supports TypeScript 7.
