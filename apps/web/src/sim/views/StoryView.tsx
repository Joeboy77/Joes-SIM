"use client";

import { formatValue, type Component, type MachineState } from "@joes-sim/engine";
import { motion } from "motion/react";
import { useId } from "react";
import { useSimState } from "../SimProvider";
import { useActivity } from "../useActivity";
import { EmptyMachine } from "./DatapathView";

// The room: a wall of mailboxes on the right, the desk with the calculator, trays and counter on
// the left. All artwork is original to Joe's SIM.
const MAILBOX = { x: 380, y: 40, size: 31, gap: 1 };
const SPOTS: Record<
  "counter" | "board" | "calculator" | "inTray" | "outTray" | "home",
  { x: number; y: number }
> = {
  counter: { x: 85, y: 205 },
  board: { x: 215, y: 205 },
  calculator: { x: 210, y: 330 },
  inTray: { x: 60, y: 330 },
  outTray: { x: 320, y: 330 },
  home: { x: 260, y: 240 },
};

function mailboxPos(address: number) {
  const col = address % 10;
  const row = Math.floor(address / 10);
  const step = MAILBOX.size + MAILBOX.gap;
  return {
    x: MAILBOX.x + col * step + MAILBOX.size / 2,
    y: MAILBOX.y + row * step + MAILBOX.size / 2,
  };
}

/** Where the Little Man stands for each part of the machine. */
function spotFor(c: Component, state: MachineState) {
  switch (c) {
    case "MEMORY":
    case "MAR":
    case "MDR": {
      const m = mailboxPos(state.mar);
      return { x: Math.max(MAILBOX.x - 18, m.x - 6), y: Math.min(400, m.y + 34) };
    }
    case "PC":
      return SPOTS.counter;
    case "IR":
    case "CONTROL":
      return SPOTS.board;
    case "ACC":
    case "ALU":
      return SPOTS.calculator;
    case "INPUT":
      return SPOTS.inTray;
    case "OUTPUT":
      return SPOTS.outTray;
  }
}

function LittleMan({ carrying }: { carrying: string | null }) {
  // Drawn at the origin, feet at y = 0.
  return (
    <g>
      <ellipse cx={0} cy={0} rx={16} ry={4} fill="var(--sim-color-border)" />
      <rect x={-9} y={-24} width={7} height={24} rx={3} fill="var(--sim-color-text)" />
      <rect x={2} y={-24} width={7} height={24} rx={3} fill="var(--sim-color-text)" />
      <rect x={-14} y={-58} width={28} height={38} rx={10} fill="var(--sim-color-accent)" />
      <circle
        cx={0}
        cy={-72}
        r={14}
        fill="#f2c9a0"
        stroke="var(--sim-color-text)"
        strokeWidth={1.5}
      />
      <path d="M-15 -78 Q0 -96 15 -78 Z" fill="var(--sim-color-write)" />
      <rect x={-17} y={-80} width={34} height={4} rx={2} fill="var(--sim-color-write)" />
      <circle cx={-5} cy={-72} r={1.8} fill="#1b1b1b" />
      <circle cx={5} cy={-72} r={1.8} fill="#1b1b1b" />
      <path d="M-5 -65 Q0 -61 5 -65" stroke="#1b1b1b" strokeWidth={1.5} fill="none" />
      {carrying !== null && (
        <g transform="translate(12,-52)">
          <line
            x1={-6}
            y1={0}
            x2={2}
            y2={2}
            stroke="var(--sim-color-text)"
            strokeWidth={4}
            strokeLinecap="round"
          />
          <rect
            x={2}
            y={-12}
            width={44}
            height={22}
            rx={3}
            fill="#fffdf2"
            stroke="var(--sim-color-text)"
            strokeWidth={1.5}
          />
          <text
            x={24}
            y={4}
            textAnchor="middle"
            fontSize={13}
            fontFamily="var(--font-mono)"
            fontWeight={700}
            fill="#1b1b1b"
          >
            {carrying}
          </text>
        </g>
      )}
    </g>
  );
}

export function StoryView() {
  const state = useSimState((s) => s.state);
  const labels = useSimState((s) => s.assembled.program?.labels);
  const { activity, stepId, duration } = useActivity();
  if (!state) return <EmptyMachine />;

  const last = activity.transfers.at(-1);
  const where = last ? spotFor(last.to, state) : SPOTS.home;
  const carrying = last ? formatValue(last.value) : null;
  const labelAt = new Map(Object.entries(labels ?? {}).map(([name, v]) => [v.address, name]));
  const output = state.outputs.slice(-3);
  const nextInput = state.inputs[state.inputIndex];

  return (
    <svg
      viewBox="0 0 712 424"
      className="h-auto w-full"
      role="img"
      aria-label={describe(state, last?.to)}
    >
      <rect x={0} y={0} width={712} height={424} fill="var(--sim-color-surface-2)" />
      <rect x={0} y={372} width={712} height={52} fill="var(--sim-color-border)" opacity={0.5} />

      {/* Wall of mailboxes */}
      {Array.from({ length: 100 }, (_, a) => {
        const m = mailboxPos(a);
        const read = activity.reads.has(a);
        const written = activity.writes.has(a);
        const current = a === state.currentAddress && state.microSteps > 0;
        return (
          <g key={a}>
            <rect
              x={m.x - MAILBOX.size / 2}
              y={m.y - MAILBOX.size / 2}
              width={MAILBOX.size}
              height={MAILBOX.size}
              rx={3}
              fill="var(--sim-color-surface)"
              stroke={
                written
                  ? "var(--sim-color-write)"
                  : read
                    ? "var(--sim-color-read)"
                    : current
                      ? "var(--sim-color-accent)"
                      : "var(--sim-color-border-strong)"
              }
              strokeWidth={written || read || current ? 3 : 1}
            />
            <text
              x={m.x}
              y={m.y - 5}
              textAnchor="middle"
              fontSize={7}
              fill="var(--sim-color-text-muted)"
            >
              {written ? "↑" : read ? "↓" : current ? "▶" : ""}
              {String(a).padStart(2, "0")}
              {labelAt.has(a) ? "•" : ""}
            </text>
            <text
              x={m.x}
              y={m.y + 9}
              textAnchor="middle"
              fontSize={10}
              fontFamily="var(--font-mono)"
              fill="var(--sim-color-text)"
            >
              {formatValue(state.memory[a] ?? 0)}
            </text>
          </g>
        );
      })}

      {activity.branch && <BranchArrow {...activity.branch} />}

      {/* Counter (PC) */}
      <rect
        x={40}
        y={40}
        width={90}
        height={54}
        rx={8}
        fill="var(--sim-color-surface)"
        stroke="var(--sim-color-border-strong)"
        strokeWidth={activity.active.has("PC") ? 4 : 2}
      />
      <text x={85} y={60} textAnchor="middle" fontSize={12} fill="var(--sim-color-text-muted)">
        Counter
      </text>
      <text
        x={85}
        y={84}
        textAnchor="middle"
        fontSize={22}
        fontFamily="var(--font-mono)"
        fill="var(--sim-color-text)"
      >
        {String(state.pc).padStart(2, "0")}
      </text>

      {/* Instruction board (IR) */}
      <rect
        x={160}
        y={40}
        width={110}
        height={54}
        rx={8}
        fill="#fffdf2"
        stroke="var(--sim-color-border-strong)"
        strokeWidth={activity.active.has("IR") || activity.active.has("CONTROL") ? 4 : 2}
      />
      <text x={215} y={60} textAnchor="middle" fontSize={12} fill="#444">
        Instruction
      </text>
      <text
        x={215}
        y={84}
        textAnchor="middle"
        fontSize={22}
        fontFamily="var(--font-mono)"
        fill="#1b1b1b"
      >
        {formatValue(state.ir)}
      </text>

      {/* Desk with calculator (ACC) */}
      <rect x={150} y={300} width={180} height={18} rx={4} fill="var(--sim-color-border-strong)" />
      <rect
        x={176}
        y={262}
        width={74}
        height={44}
        rx={6}
        fill="var(--sim-color-surface)"
        stroke="var(--sim-color-border-strong)"
        strokeWidth={activity.active.has("ACC") || activity.active.has("ALU") ? 4 : 2}
      />
      <text
        x={213}
        y={290}
        textAnchor="middle"
        fontSize={18}
        fontFamily="var(--font-mono)"
        fill="var(--sim-color-text)"
      >
        {formatValue(state.acc)}
      </text>
      <text x={213} y={256} textAnchor="middle" fontSize={11} fill="var(--sim-color-text-muted)">
        Calculator{state.negative ? " (negative)" : ""}
      </text>

      {/* Trays */}
      <rect
        x={20}
        y={340}
        width={90}
        height={26}
        rx={4}
        fill="var(--sim-color-surface)"
        stroke="var(--sim-color-read)"
        strokeWidth={activity.active.has("INPUT") ? 4 : 2}
      />
      <text x={65} y={334} textAnchor="middle" fontSize={11} fill="var(--sim-color-text-muted)">
        In-tray
      </text>
      <text
        x={65}
        y={358}
        textAnchor="middle"
        fontSize={13}
        fontFamily="var(--font-mono)"
        fill="var(--sim-color-text)"
      >
        {nextInput === undefined ? "empty" : formatValue(nextInput)}
      </text>
      <rect
        x={280}
        y={340}
        width={90}
        height={26}
        rx={4}
        fill="var(--sim-color-surface)"
        stroke="var(--sim-color-write)"
        strokeWidth={activity.active.has("OUTPUT") ? 4 : 2}
      />
      <text x={325} y={334} textAnchor="middle" fontSize={11} fill="var(--sim-color-text-muted)">
        Out-tray
      </text>
      <text
        x={325}
        y={358}
        textAnchor="middle"
        fontSize={13}
        fontFamily="var(--font-mono)"
        fill="var(--sim-color-text)"
      >
        {output.length
          ? output.map((o) => (o.kind === "char" ? o.char : formatValue(o.value))).join(" ")
          : "empty"}
      </text>

      <motion.g
        initial={false}
        animate={{ x: where.x, y: where.y }}
        transition={
          duration > 0 ? { duration: duration / 1000, ease: "easeInOut" } : { duration: 0 }
        }
        key={duration > 0 ? undefined : stepId}
      >
        <LittleMan carrying={carrying} />
      </motion.g>
    </svg>
  );
}

/** A curved arrow across the mailbox wall from a branch to its target: solid if taken, dashed if not. */
function BranchArrow({ from, target, taken }: { from: number; target: number; taken: boolean }) {
  const id = `branch-head-${useId().replace(/:/g, "")}`;
  const a = mailboxPos(from);
  const b = mailboxPos(target);
  const colour = "var(--sim-color-branch)";
  let d: string;
  if (from === target) {
    // A branch to itself: a small loop above the mailbox.
    d = `M${a.x - 8} ${a.y - 14} C${a.x - 30} ${a.y - 50} ${a.x + 30} ${a.y - 50} ${a.x + 8} ${a.y - 14}`;
  } else {
    // Bow the curve to one side so it does not run straight through the mailboxes in between.
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const bow = Math.min(60, 20 + len / 4);
    d = `M${a.x} ${a.y} Q${mx - (dy / len) * bow} ${my + (dx / len) * bow} ${b.x} ${b.y}`;
  }
  return (
    <g aria-hidden="true" pointerEvents="none">
      <defs>
        <marker
          id={id}
          viewBox="0 0 10 10"
          refX={8}
          refY={5}
          markerWidth={6}
          markerHeight={6}
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 Z" fill={colour} />
        </marker>
      </defs>
      <path
        d={d}
        fill="none"
        stroke={colour}
        strokeWidth={3}
        strokeDasharray={taken ? undefined : "6 5"}
        markerEnd={`url(#${id})`}
      />
    </g>
  );
}

function describe(state: MachineState, at: Component | undefined): string {
  const where = at
    ? {
        MEMORY: "the mailboxes",
        MAR: "the mailboxes",
        MDR: "the mailboxes",
        PC: "the counter",
        IR: "the instruction board",
        CONTROL: "the instruction board",
        ACC: "the calculator",
        ALU: "the calculator",
        INPUT: "the in-tray",
        OUTPUT: "the out-tray",
      }[at]
    : "the middle of the room";
  return `Story view. The Little Man is at ${where}. Counter ${state.pc}, calculator ${formatValue(state.acc)}.`;
}
