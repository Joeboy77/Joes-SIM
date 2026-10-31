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
