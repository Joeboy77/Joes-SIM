# 0013: Phone layout and presentation mode

## Context

A beginner must be able to write, run and debug a program on a phone without instructions.

## Choice

- Below the `lg` breakpoint the screen shows one panel at a time (Code, Machine, Inputs &
  output). Tabs switch panels, and so does a swipe left or right.
- The run bar moves to the bottom of the screen, within reach of the thumb. Speed, dialect,
  view and presentation are behind a ⚙ button so the main buttons stay large (44 px or more).
- From `lg` up there are three columns: code, machine, inputs and output.
- Presentation mode sets the root font size to 137.5%, so everything sized in rem grows
  together for projectors.

## Reason

Tabs keep each panel large enough to read on a 360 px wide screen. The browser tests run every
journey at phone size as well as desktop.
