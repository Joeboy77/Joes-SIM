# 0020: Side panels and the third view

## Choice

- On larger screens, inputs and output stay in view on the right. Below them, Explain
  (narration, problems and hints), Trace and Watch share tabs.
- On phones the six parts are tabs: Code, Machine, Explain, Trace, Watch, Inputs & output.
- The flow graph is a third machine view, next to datapath and story. A View select replaces
  the old two-way toggle, and V cycles through all three.
- The flow graph is built from the program as assembled. Blocks are stacked in address order,
  forward branches are drawn on the right and loops on the left, with a counter showing how many
  times each loop has gone round. Self-modifying code is shown as it was written, not as it
  became.
- The heatmap colours each mailbox by how often it was run, read and written, and labels it as
  code, data, both or unused from how the run actually used it. Mailboxes with heat colour use
  full-contrast text, because muted text failed WCAG contrast on the hottest cells.
