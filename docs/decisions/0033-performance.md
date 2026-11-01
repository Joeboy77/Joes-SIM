# 0033: Performance

## Context

The acceptance criteria ask for Lighthouse mobile scores of at least 90 in every category on the
home page and simulator, and for the simulator to load in under 3 seconds on slow 4G.

## What was changed

- The simulator was first drawn only after the learner's saved work had loaded (Phase 4). Now
  it is drawn by the server at once and locked for the few milliseconds the load takes.
- The code shows as plain text straight away; the full editor (CodeMirror) is built just after
  the first paint and replaces it.
- A mismatch between the server's HTML and the first render (from reading `navigator` while
  rendering the Share button) was fixed; it had cost the best-practices score.

## Results (production build, measured locally with Lighthouse 12.6)

| Page      | Mode                     | Performance | Accessibility | Best practices | SEO | LCP       |
| --------- | ------------------------ | ----------- | ------------- | -------------- | --- | --------- |
| Home      | default (simulated)      | 97–99       | 100           | 100            | 100 | 2.0–2.5 s |
| Simulator | default (simulated)      | 94–95       | 100           | 100            | 100 | 2.8–3.0 s |
| Home      | throttled in the browser | 93          | 100           | 100            | 100 | 1.4 s     |
| Simulator | throttled in the browser | 96          | 100           | 100            | 100 | 1.5 s     |

Under slow 4G (150 ms round trip, 1.6 Mbps, CPU slowed 4×) on a phone-sized screen, the
simulator's largest paint (the program) was at 0.66 s and the page finished loading at 2.6 s.

## Caveat

These were measured on a local server. A deployed site adds real network distance; the numbers
should be checked again after deployment.

## Re-check after Phases 6–11 (2026-11-01)

Measured again after the extended machine, pipeline, cache, multicore, compiler, RISC-V, machine
designer and community features were added. Lighthouse 12.6, mobile, local production build. The
"simulated" column is the median of three runs.

At first, four pages were under 90:

- **The simulator** scored 75–88. Its status line was replaced by a longer sentence once the page
  loaded, which pushed the page down on phones (layout shift 0.24). Its first download had also
  grown.
- **RISC-V, the compiler and the machine designer** drew nothing on the server and filled in after
  loading, which pushed the footer down (layout shift 0.16).

The fixes:

- **The status line** on phones gets two lines of its own, so its height never changes.
- **Those three pages** draw their starter program on the server. The browser then swaps in the
  learner's saved work.
- **The code editor (CodeMirror)** loads after the first paint, with `import()`, instead of being
  part of the first download. The plain-text preview covers the moment it takes.
- **The service worker** now caches every build file at install, not only those named in pages'
  HTML. Files loaded with `import()` therefore work offline too.

Results after the fixes:

| Page               | Simulated | Throttled in the browser | Accessibility | Best practices | SEO | Layout shift |
| ------------------ | --------- | ------------------------ | ------------- | -------------- | --- | ------------ |
| Home               | 99        | –                        | 100           | 100            | 100 | 0            |
| Simulator          | 92–95     | 96                       | 100           | 100            | 100 | 0            |
| Challenge (echo)   | 99        | –                        | 100           | 100            | 100 | 0            |
| Compiler           | 98        | –                        | 100           | 100            | 100 | 0            |
| RISC-V             | 99        | –                        | 100           | 100            | 100 | 0            |
| Machine designer   | 99        | –                        | 100           | 100            | 100 | 0            |
| Gallery            | 97        | –                        | 100           | 96\*           | 100 | 0.02         |
| From LMC to RISC-V | 92        | –                        | 100           | 100            | 100 | 0            |

\* The gallery was measured without the community API running, so its failed request logged a
console error.

In a real browser with the CPU slowed 4×, the simulator's largest paint (the program) is at 0.3 s.
Lighthouse's simulated figure (about 3 s) charges for every script the page loads before that
point. Keeping the first download small is what keeps that score above 90.
