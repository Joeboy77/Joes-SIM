# Accessibility audit (WCAG 2.2 AA)

Last audited: Phase 5, October 2026. Method, results and known gaps.

## How it was checked

- **Automated, every build.** axe-core (WCAG 2.0, 2.1 and 2.2 A and AA rules) runs in the
  browser tests on every page, in the light, dark and high-contrast themes, on desktop and phone
  sizes. It also runs on the simulator's three views, the trace table (including fill-in mode
  with answers checked), the Watch panel, the heatmap, a challenge after its tests run, lessons
  with several simulators, and a right-to-left page.
- **Lighthouse** (mobile): accessibility 100 on the home page and the simulator.
- **Keyboard.** A test tabs through the home page in order; every simulator control has a
  shortcut or is reachable by Tab; scrollable areas (code, trace table, flow graph, wide tables,
  code examples) take focus.
- **Reflow (1.4.10).** Tests load eight main pages at 320 CSS pixels wide and check that nothing
  needs sideways scrolling.
- **Text spacing (1.4.12).** A test applies the WCAG spacing values and checks nothing overflows.
- **Reduced motion (2.3.3).** A test checks that with reduced motion the datapath lists value
  movements as text instead of animating them.
- **Contrast (1.4.3, 1.4.11).** A unit test checks every colour pair in all three themes.

## Results by principle

| Area                                       | Status         | Notes                                                                                                                   |
| ------------------------------------------ | -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Text alternatives                          | Pass           | The datapath, story and flow views have full text descriptions; decorative icons are hidden.                            |
| Adaptable, reflow                          | Pass           | Fixed in Phase 5: the simulator header now wraps at 320 px, and the instruction table scrolls in its own box.           |
| Distinguishable                            | Pass           | Reads, writes, branches and test results use icons and words, never colour alone. Heatmap cells use full-contrast text. |
| Keyboard, focus visible                    | Pass           | Fixed in Phase 5: long code examples in the docs take focus.                                                            |
| Target size (2.5.8)                        | Pass           | Buttons are at least 44 by 44 CSS pixels; the trace table's step buttons are at least 36.                               |
| Label in name (2.5.3)                      | Pass           | Mailbox buttons build their spoken name from the visible text.                                                          |
| Language of page (3.1.1)                   | Pass           | `lang` and `dir` follow the chosen language, before the page paints.                                                    |
| Status messages (4.1.3)                    | Pass           | Run status, narration (when not playing fast), test results and saves use live regions.                                 |
| Consistent help (3.2.6)                    | Pass           | Docs and keyboard help are in the same place on every page.                                                             |
| Redundant entry, accessible authentication | Not applicable | No forms that repeat information, and no sign-in.                                                                       |

## Known gaps

- **Screen reader testing by hand** (NVDA, JAWS, VoiceOver, TalkBack) has not been done yet.
  Automated tools cannot judge whether the narration and live regions are pleasant to use.
  This should be done with learners who use screen readers.
- **Translations.** Only English exists. Other languages fall back to English text.
- **The code editor.** CodeMirror supports screen readers, but reading LMC code aloud has not
  been tested with learners.
