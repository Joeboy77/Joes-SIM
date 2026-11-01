/**
 * The beginner lesson path (brief, 7.9 and 8.3). Each lesson's details live here, typed, rather
 * than as front matter, so a mistake is a build error (decision 0023). Text is CC BY 4.0.
 */
import type { DialectId } from "@joes-sim/engine";

export interface LessonInfo {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly minutes: number;
  readonly concepts: readonly string[];
  readonly prerequisites: readonly string[];
  readonly dialect: DialectId;
  /** Present for lessons on the extended or multicore machine. */
  readonly machine?: "extended" | "multicore";
}

export const LESSONS: readonly LessonInfo[] = [
  {
    slug: "what-is-a-computer",
    title: "What is a computer?",
    summary: "Input, processing, memory and output: the parts every computer has.",
    minutes: 6,
    concepts: ["von Neumann model"],
    prerequisites: [],
    dialect: "classic",
  },
  {
    slug: "meet-the-little-man",
    title: "Meet the Little Man",
    summary: "A room of 100 mailboxes, a counter and a calculator: the Little Man Computer.",
    minutes: 8,
    concepts: ["memory", "registers"],
    prerequisites: ["what-is-a-computer"],
    dialect: "classic",
  },
  {
    slug: "fetch-decode-execute",
    title: "Fetch, decode, execute",
    summary: "The three-step cycle that runs every instruction, one micro-step at a time.",
    minutes: 10,
    concepts: ["instruction cycle"],
    prerequisites: ["meet-the-little-man"],
    dialect: "classic",
  },
  {
    slug: "input-and-output",
    title: "Your first program",
    summary: "INP, OUT and HLT: read a number, show it, stop.",
    minutes: 8,
    concepts: ["input-output"],
    prerequisites: ["fetch-decode-execute"],
    dialect: "classic",
  },
  {
    slug: "keeping-numbers",
    title: "Keeping numbers",
    summary: "STA, LDA and DAT: storing values in mailboxes and loading them back.",
    minutes: 10,
    concepts: ["memory", "input-output"],
    prerequisites: ["input-and-output"],
    dialect: "classic",
  },
  {
    slug: "arithmetic",
    title: "Adding and subtracting",
    summary: "ADD and SUB, what happens when an answer does not fit, and the negative flag.",
    minutes: 10,
    concepts: ["arithmetic", "negative numbers"],
    prerequisites: ["keeping-numbers"],
    dialect: "classic",
  },
  {
    slug: "decisions",
    title: "Making decisions",
    summary: "BRA, BRZ and BRP: choosing which instruction runs next.",
    minutes: 12,
    concepts: ["branching"],
    prerequisites: ["arithmetic"],
    dialect: "classic",
  },
  {
    slug: "loops",
    title: "Going round again",
    summary: "A branch backwards makes a loop. Make sure it can stop.",
    minutes: 12,
    concepts: ["loops"],
    prerequisites: ["decisions"],
    dialect: "classic",
  },
  {
    slug: "counters-and-totals",
    title: "Counters and running totals",
    summary: "Two patterns that solve most loop problems.",
    minutes: 12,
    concepts: ["loops", "arithmetic"],
    prerequisites: ["loops"],
    dialect: "classic",
  },
  {
    slug: "arrays",
    title: "Arrays and self-modifying code",
    summary: "Instructions are numbers, so a program can build the instruction it needs.",
    minutes: 15,
    concepts: ["arrays", "self-modifying code"],
    prerequisites: ["counters-and-totals"],
    dialect: "classic",
  },
  {
    slug: "addressing-modes",
    title: "Pointers and indexes",
    summary: "Indirect and indexed addressing: reaching a mailbox whose address you work out.",
    minutes: 12,
    concepts: ["addressing modes", "arrays"],
    prerequisites: ["arrays"],
    dialect: "classic",
    machine: "extended",
  },
  {
    slug: "stack-and-subroutines",
    title: "The stack and subroutines",
    summary: "PUSH, POP, CALL and RET: reusing code and finding the way back.",
    minutes: 15,
    concepts: ["stack", "subroutines"],
    prerequisites: ["addressing-modes"],
    dialect: "classic",
    machine: "extended",
  },
  {
    slug: "interrupts-and-devices",
    title: "Interrupts and devices",
    summary: "Talking to a display, a keyboard and a timer, and letting them interrupt you.",
    minutes: 15,
    concepts: ["interrupts", "input-output devices"],
    prerequisites: ["stack-and-subroutines"],
    dialect: "classic",
    machine: "extended",
  },
  {
    slug: "pipelining",
    title: "Pipelining",
    summary: "Overlapping instructions like a production line, and what makes them wait.",
    minutes: 15,
    concepts: ["pipelining", "hazards"],
    prerequisites: ["addressing-modes"],
    dialect: "classic",
    machine: "extended",
  },
  {
    slug: "caches",
    title: "Caches",
    summary: "A small, fast memory that keeps what the program is using now.",
    minutes: 12,
    concepts: ["memory hierarchy", "caches"],
    prerequisites: ["pipelining"],
    dialect: "classic",
    machine: "extended",
  },
  {
    slug: "races-and-locks",
    title: "Many cores: races and locks",
    summary: "Two Little Men share the mailboxes. Watch them collide, then make them take turns.",
    minutes: 15,
    concepts: ["parallelism", "race conditions", "locks"],
    prerequisites: ["loops"],
    dialect: "classic",
    machine: "multicore",
  },
];

export const lessonBySlug = (slug: string) => LESSONS.find((l) => l.slug === slug);
