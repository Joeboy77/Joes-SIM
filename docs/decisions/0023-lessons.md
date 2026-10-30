# 0023: Lessons in MDX

## Context

The brief (7.9, 8.2) asks for lessons written in MDX with front matter and components such as
`<Simulator>`, `<Predict>` and `<Highlight>`.

## Choice

- Lessons are MDX files in `apps/web/src/lessons/content/`, compiled by `@next/mdx` into static
  pages.
- Each lesson's details (title, summary, minutes, concepts, prerequisites, dialect) live in a
  typed list, `lessons/catalogue.ts`, instead of YAML front matter. A mistake is then a build
  error, the lesson list does not have to load every lesson, and no extra MDX plugins are
  needed.
- Components: `<LessonSim>` (a full simulator with its own state: program, inputs, dialect,
  view, a part to highlight, a step to pause at, memory grid and predict mode on or off),
  `<Predict>` (a multiple-choice question that explains its answer), `<Highlight>` (a word that
  lights up its part in the lesson's simulators) and `<Note>`.
- Panels that a lesson can show more than once use generated ids, so several simulators can
  share a page.
- The ten-lesson beginner path runs from "What is a computer?" to arrays and self-modifying
  code. "I have finished this lesson" is saved on the device.

## Reason

A typed list catches errors early and keeps the MDX files about the teaching.
