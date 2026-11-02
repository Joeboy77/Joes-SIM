# 0011: How the machine is animated

## Context

The brief asks for values that travel along the buses, a Little Man who walks and carries
slips, read and write flashes that do not rely on colour, branch arrows, and reverse animation
when stepping back at slow speeds.

## Choice

- **Speeds** (`apps/web/src/sim/speeds.ts`): manual, slow and normal move one micro-step per
  tick. Slow ticks every 1.5 s and normal every 0.36 s, so one instruction (about 7 micro-steps)
  takes about 10 s and 2.5 s. Fast moves one instruction every 0.45 s and plays its transfers
  one after another in 60 ms hops, so values still visibly move. Instant runs to the end in a
  web worker.
- **Events drive everything.** The engine's micro-step events become transfers, active
  components, reads, writes and a branch. Stepping back reverses the transfers. They play in
  reverse at slow and manual speeds; at other speeds the view jumps to the new state.
- **Never colour alone.** Reads show ↓, writes ↑, the running mailbox ▶, breakpoints ● and
  branch targets ↪. Every mailbox's spoken name includes its address, value, label, meaning
  and marks, and is built from the visible text so it always contains what is shown (WCAG 2.5.3).
- **Branches** get a note under the machine ("taken, jumping there" or "not taken"), a curved
  arrow on the story view's mailbox wall (solid if taken, dashed if not), and a marked target
  in the memory grid.
- **Reduced motion.** If the device asks for less motion, nothing moves. Transfers are listed
  as text in the datapath view instead.
- **motion/react** handles the tweens. It animates transforms only, which the browser can run
  off the main thread.

**Retuned after Phase 11.** The project owner found slow not slow enough (0.9 s a micro-step) and fast far
too fast: it moved about 16 instructions a second with no movement, about 37 times faster than
normal, so a program was over before it could be followed. Programs that need raw speed use
instant.

## Reason

Driving the views from events keeps the views and the engine separate, so new views (pipeline,
cache) can be added in later phases without engine changes.

## Not yet confirmed

The brief asks for 60 frames per second on a mid-range Android phone at normal speed. In
headless Chromium with Pixel 7 emulation and the CPU slowed 4×, both views averaged 60.0 fps
over 5 seconds of a running countdown, with no frame longer than 16.8 ms. No real phone has been
measured yet. After Phase 3, the same test with the heatmap on still averaged 60.0 fps
in all three views (datapath, story and flow graph). The check stays open until it can be
measured on a device.
