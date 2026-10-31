/**
 * The DCIT 207 pack (brief, 7.10 and section 9): the course topics, in order, with the lessons,
 * challenges and programs that support each one. Topics that need machines from later phases
 * (pipeline, cache, interrupts, multicore, RISC-V) say so, and will be filled in as they arrive.
 */
import type { Pack } from "./types";

export const DCIT_207: Pack = {
  format: "joes-sim-pack",
  version: 1,
  id: "dcit-207",
  title: "DCIT 207: Computer Organisation and Architecture",
  author: "Joe's SIM",
  description:
    "A path through Joe's SIM that follows the DCIT 207 course topics, from the von Neumann model to performance.",
  dialect: "classic",
  items: [
    {
      type: "heading",
      title: "1. Evolution of computers and the von Neumann model",
      note: "Use the story view and the datapath view side by side: they are the same machine.",
    },
    { type: "lesson", slug: "what-is-a-computer" },
    { type: "lesson", slug: "meet-the-little-man" },

    { type: "heading", title: "2. Processor structure and the control unit" },
    { type: "lesson", slug: "fetch-decode-execute" },
    {
      type: "program",
      title: "Watch one instruction, micro-step by micro-step",
      source:
        "        LDA 05\n        ADD 06\n        OUT\n        HLT\n        DAT 0\n        DAT 20\n        DAT 22\n",
      note: "Press Micro repeatedly and read the Explain panel. Which registers does each micro-step use?",
    },

    { type: "heading", title: "3. Instruction sets, assembly and machine language" },
    { type: "lesson", slug: "input-and-output" },
    { type: "lesson", slug: "keeping-numbers" },
    { type: "challenge", id: "echo" },
    { type: "challenge", id: "sum-two-numbers" },
    { type: "challenge", id: "swap-two" },
    {
      type: "program",
      title: "Assembly next to machine code",
      source:
        "        INP\n        STA first\n        INP\n        ADD first\n        OUT\n        HLT\nfirst   DAT\n",
      inputs: "3, 4",
      note: "Look at the memory grid: every instruction is a three-digit number. Point at a mailbox to see it in binary.",
    },

    {
      type: "heading",
      title: "4. Data representation",
      note: "Turn on the heatmap, and use the Watch panel's binary, hex and two's complement columns.",
    },
    { type: "lesson", slug: "arithmetic" },
    { type: "challenge", id: "add-ten" },
    { type: "challenge", id: "negate" },
    { type: "challenge", id: "sign" },
    { type: "challenge", id: "digit-char" },

    { type: "heading", title: "5. Control flow: branches and loops" },
    { type: "lesson", slug: "decisions" },
    { type: "lesson", slug: "loops" },
    { type: "lesson", slug: "counters-and-totals" },
    { type: "challenge", id: "max-of-two" },
    { type: "challenge", id: "countdown" },
    { type: "challenge", id: "multiply" },
    { type: "challenge", id: "bug-countdown-zero" },

    {
      type: "heading",
      title: "6. Addressing and subroutines",
      note: "Classic LMC has only direct addressing, so arrays and subroutine returns need self-modifying code. The extended machine (a later version) adds indirect and indexed addressing, a stack, CALL and RET.",
    },
    { type: "lesson", slug: "arrays" },
    { type: "challenge", id: "lookup-table" },
    { type: "challenge", id: "double-subroutine" },

    {
      type: "heading",
      title: "7. Performance",
      note: "Each solved challenge reports instructions, cycles and mailboxes. Try to beat the targets.",
    },
    { type: "challenge", id: "triangular" },
    { type: "challenge", id: "gcd" },

    {
      type: "heading",
      title:
        "Coming later: pipelining, memory hierarchy and cache, I/O and interrupts, multicore, RISC-V",
      note: "These topics need the pipeline, cache, extended, multicore and RISC-V machines from later versions of Joe's SIM. This pack will grow as they arrive.",
    },
  ],
};

export const BUILT_IN_PACKS: readonly Pack[] = [DCIT_207];
