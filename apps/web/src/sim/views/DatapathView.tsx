"use client";

import { formatValue, type Component } from "@joes-sim/engine";
import { motion } from "motion/react";
import { useSimState } from "../SimProvider";
import { useActivity } from "../useActivity";

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly title: string;
  readonly hint: string;
}

const BOX_W = 132;
const BOX_H = 62;

const BOXES: Record<Component, Box> = {
  INPUT: { x: 16, y: 16, w: BOX_W, h: BOX_H, title: "Input", hint: "next value in the input tray" },
  PC: { x: 16, y: 126, w: BOX_W, h: BOX_H, title: "PC", hint: "program counter" },
  MAR: { x: 196, y: 126, w: BOX_W, h: BOX_H, title: "MAR", hint: "memory address register" },
  MEMORY: { x: 396, y: 96, w: 300, h: 150, title: "Memory", hint: "100 mailboxes" },
  IR: { x: 16, y: 236, w: BOX_W, h: BOX_H, title: "IR", hint: "instruction register" },
  MDR: { x: 196, y: 236, w: BOX_W, h: BOX_H, title: "MDR", hint: "memory data register" },
  CONTROL: {
    x: 16,
    y: 346,
    w: BOX_W,
    h: BOX_H,
    title: "Control unit",
    hint: "decodes the instruction",
  },
  ALU: { x: 196, y: 346, w: BOX_W, h: BOX_H, title: "ALU", hint: "adds and subtracts" },
  ACC: { x: 376, y: 346, w: BOX_W, h: BOX_H, title: "ACC", hint: "accumulator" },
  OUTPUT: { x: 564, y: 346, w: BOX_W, h: BOX_H, title: "Output", hint: "last value output" },
};

const centre = (c: Component) => {
  const b = BOXES[c];
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
};

/** Bus route between two components, as points. Orthogonal, through the gap between them. */
function route(from: Component, to: Component): { x: number; y: number }[] {
  const a = centre(from);
  const b = centre(to);
  if (a.x === b.x || a.y === b.y) return [a, b];
  const midY = (a.y + b.y) / 2;
  return [a, { x: a.x, y: midY }, { x: b.x, y: midY }, b];
}

const BUSES: [Component, Component][] = [
  ["PC", "MAR"],
  ["MAR", "MEMORY"],
  ["MEMORY", "MDR"],
  ["MDR", "IR"],
  ["IR", "MAR"],
  ["IR", "CONTROL"],
  ["IR", "PC"],
  ["MDR", "ALU"],
  ["ALU", "ACC"],
  ["ACC", "MDR"],
  ["INPUT", "ACC"],
  ["ACC", "OUTPUT"],
];

const toPath = (points: { x: number; y: number }[]) =>
  points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");

export function DatapathView() {
  const state = useSimState((s) => s.state);
  const { activity, stepId, duration, reduced } = useActivity();
  const hover = useSimState((s) => s.hoverTerm);
  if (!state) return <EmptyMachine />;

  const decodedOp = Math.floor(state.ir / 100);
  const decodedAddr = ((state.ir % 100) + 100) % 100;
  const lastOut = state.outputs.at(-1);
  const nextInput = state.inputs[state.inputIndex];

  const values: Record<Component, string> = {
    INPUT: nextInput === undefined ? "empty" : formatValue(nextInput),
    PC: String(state.pc).padStart(2, "0"),
    MAR: String(state.mar).padStart(2, "0"),
    MEMORY: `[${String(state.mar).padStart(2, "0")}] = ${formatValue(state.memory[state.mar] ?? 0)}`,
    IR:
      state.ir < 0
        ? formatValue(state.ir)
        : `${decodedOp} | ${String(decodedAddr).padStart(2, "0")}`,
    MDR: formatValue(state.mdr),
    CONTROL: state.stage >= 5 ? `executing` : state.stage === 4 ? "decoding" : "fetching",
    ALU: "+  −",
    ACC: formatValue(state.acc),
    OUTPUT: lastOut
      ? lastOut.kind === "char"
        ? JSON.stringify(lastOut.char)
        : formatValue(lastOut.value)
      : "none",
  };

  return (
    <svg
      viewBox="0 0 712 424"
      className="h-auto w-full"
      role="img"
      aria-label={`Datapath. PC ${values.PC}, MAR ${values.MAR}, MDR ${values.MDR}, IR ${values.IR}, accumulator ${values.ACC}, negative flag ${state.negative ? "set" : "clear"}.`}
    >
      {BUSES.map(([a, b]) => {
        const on = activity.transfers.some(
          (t) => (t.from === a && t.to === b) || (t.from === b && t.to === a),
        );
        return (
          <path
            key={`${a}-${b}`}
            d={toPath(route(a, b))}
            fill="none"
            stroke={on ? "var(--sim-color-accent)" : "var(--sim-color-border)"}
            strokeWidth={on ? 5 : 3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}

      {(Object.keys(BOXES) as Component[]).map((c) => {
        const b = BOXES[c];
        const on = activity.active.has(c);
        const pointed = hover === c;
        return (
          <g key={c}>
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={10}
              fill="var(--sim-color-surface)"
              stroke={
                pointed
                  ? "var(--sim-color-branch)"
                  : on
                    ? "var(--sim-color-accent)"
                    : "var(--sim-color-border-strong)"
              }
              strokeWidth={on || pointed ? 4 : 2}
              strokeDasharray={pointed ? "8 4" : undefined}
            />
            <text
              x={b.x + 10}
              y={b.y + 20}
              fontSize={13}
              fontWeight={700}
              fill="var(--sim-color-text)"
            >
              {b.title}
              {on ? " ●" : ""}
            </text>
            <text
              x={b.x + 10}
              y={b.y + (c === "MEMORY" ? 52 : 46)}
              fontSize={c === "MEMORY" ? 20 : 19}
              fontFamily="var(--font-mono)"
              fill="var(--sim-color-text)"
            >
              {values[c]}
            </text>
            {c === "MEMORY" && (
              <text x={b.x + 10} y={b.y + 80} fontSize={12} fill="var(--sim-color-text-muted)">
                {activity.writes.size
                  ? `↑ wrote mailbox ${[...activity.writes].join(", ")}`
                  : activity.reads.size
                    ? `↓ read mailbox ${[...activity.reads].join(", ")}`
                    : b.hint}
              </text>
            )}
          </g>
        );
      })}

      <g>
        <rect
          x={540}
          y={266}
          width={156}
          height={46}
          rx={10}
          fill="var(--sim-color-surface)"
          stroke="var(--sim-color-border-strong)"
          strokeWidth={2}
        />
        <text x={550} y={294} fontSize={14} fill="var(--sim-color-text)">
          Negative flag: <tspan fontWeight={700}>{state.negative ? "SET" : "clear"}</tspan>
        </text>
      </g>

      {duration > 0 &&
        activity.transfers.map((t, i) => {
          const points = route(t.from, t.to);
          return (
            <motion.g
              key={`${stepId}-${i}`}
              initial={{ x: points[0]?.x ?? 0, y: points[0]?.y ?? 0, opacity: 0 }}
              animate={{
                x: points.map((p) => p.x),
                y: points.map((p) => p.y),
                opacity: [1, 1, 1, 0].slice(0, Math.max(2, points.length)),
              }}
              transition={{
                duration: duration / 1000,
                delay: (i * duration) / 1000,
                ease: "easeInOut",
              }}
              aria-hidden="true"
            >
              <rect x={-26} y={-14} width={52} height={28} rx={14} fill="var(--sim-color-accent)" />
              <text
                textAnchor="middle"
                y={6}
                fontSize={15}
                fontFamily="var(--font-mono)"
                fontWeight={700}
                fill="var(--sim-color-on-accent)"
              >
                {formatValue(t.value)}
              </text>
            </motion.g>
          );
        })}
      {reduced && activity.transfers.length > 0 && (
        <text x={356} y={418} textAnchor="middle" fontSize={12} fill="var(--sim-color-text-muted)">
          {activity.transfers
            .map((t) => `${t.from} → ${t.to}: ${formatValue(t.value)}`)
            .join("   ")}
        </text>
      )}
    </svg>
  );
}

export function EmptyMachine() {
  return (
    <div className="flex h-full min-h-40 items-center justify-center rounded-md border border-dashed border-border-strong p-6 text-center text-muted">
      Fix the errors in your program to load it into the machine.
    </div>
  );
}
