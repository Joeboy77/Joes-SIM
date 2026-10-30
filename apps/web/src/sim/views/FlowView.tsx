"use client";

import { buildCfg, disassembleWord, type CfgEdge } from "@joes-sim/engine";
import { motion } from "motion/react";
import { useMemo } from "react";
import { useSimState } from "../SimProvider";
import { useActivity } from "../useActivity";
import { useTrace } from "../useTrace";
import { EmptyMachine } from "./DatapathView";

const LINE = 20;
const PAD = 10;
const GAP = 34;
const BOX_X = 150;
const BOX_W = 240;
const LANE = 16;
const WIDTH = 560;

/** "SUB one" rather than "SUB 05", when the source used a label. */
function withLabel(d: ReturnType<typeof disassembleWord>, labelAt: Map<number, string>): string {
  const label =
    d.kind === "instruction" && d.address !== undefined ? labelAt.get(d.address) : undefined;
  return label ? `${d.text.split(" ")[0]} ${label}` : d.text;
}

interface Placed {
  readonly id: number;
  readonly y: number;
  readonly h: number;
  readonly addresses: readonly number[];
}

/**
 * The program's structure (brief, 7.5): blocks of straight-line code joined by branches. During a
 * run the current block is highlighted, the path taken is drawn solid, and each loop counts how
 * many times it has gone round.
 */
export function FlowView() {
  const program = useSimState((s) => s.assembled.program);
  const state = useSimState((s) => s.state);
  const dialect = useSimState((s) => s.dialect);
  const { trace } = useTrace();
  const { duration } = useActivity();
  const stepId = useSimState((s) => s.stepId);

  const graph = useMemo(() => {
    if (!program) return null;
    const cfg = buildCfg(program.memory, program.dialect);
    let y = 16;
    const placed: Placed[] = cfg.blocks.map((b) => {
      const h = b.addresses.length * LINE + PAD * 2;
      const p = { id: b.id, y, h, addresses: b.addresses };
      y += h + GAP;
      return p;
    });
    const labelAt = new Map(Object.entries(program.labels).map(([n, v]) => [v.address, n]));
    const backEdges = new Set(cfg.loops.map((l) => `${l.latch}-${l.header}`));
    const headers = new Set(cfg.loops.map((l) => l.header));
    // Lanes keep edges on the same side from running over each other.
    let right = 0;
    let left = 0;
    const routed = cfg.edges.map((e) => {
      const from = placed[e.from] as Placed;
      const to = placed[e.to] as Placed;
      const straight = e.to === e.from + 1 && e.kind !== "taken" && e.kind !== "jump";
      const back = backEdges.has(`${e.from}-${e.to}`) || e.to <= e.from;
      const lane = straight ? 0 : back ? left++ : right++;
      return { edge: e, from, to, straight, back, lane };
    });
    return { cfg, placed, labelAt, headers, routed, height: y };
  }, [program]);

  if (!program || !state || !graph) return <EmptyMachine />;
  const { cfg, placed, labelAt, headers, routed, height } = graph;
  if (cfg.blocks.length === 0) return <EmptyMachine />;

  const started = state.microSteps > 0;
  const here = state.stage === 0 ? state.pc : state.currentAddress;
  const currentBlock = started ? cfg.blockOf[here] : null;
  const lastRow = trace?.rows.at(-1);
  const countOf = (e: CfgEdge) => {
    const from = (placed[e.from] as Placed).addresses.at(-1) ?? 0;
    const to = (placed[e.to] as Placed).addresses[0] ?? 0;
    return { key: from * 100 + to, count: trace?.transitions.get(from * 100 + to) ?? 0 };
  };
  const lastKey = lastRow ? lastRow.address * 100 + lastRow.pc : -1;
  const lineY = (p: Placed, address: number) =>
    p.y + PAD + p.addresses.indexOf(address) * LINE + LINE / 2;

  const loops = cfg.loops.map((l) => {
    const e = cfg.edges.find((x) => x.from === l.latch && x.to === l.header);
    const first = (placed[l.header] as Placed).addresses[0] ?? 0;
    return { first, count: e ? countOf(e).count : 0 };
  });
  const summary = [
    `Flow graph: ${cfg.blocks.length} block${cfg.blocks.length === 1 ? "" : "s"}, ${cfg.loops.length} loop${cfg.loops.length === 1 ? "" : "s"}.`,
    currentBlock !== null && currentBlock !== undefined
      ? `Now in the block starting at mailbox ${String((placed[currentBlock] as Placed).addresses[0]).padStart(2, "0")}.`
      : "",
    ...loops.map(
      (l) =>
        `The loop back to mailbox ${String(l.first).padStart(2, "0")} has gone round ${l.count} time${l.count === 1 ? "" : "s"}.`,
    ),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="max-h-[32rem] overflow-auto" tabIndex={0} aria-label="Flow graph, scrollable">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={summary}
      >
        <defs>
          <marker
            id="flow-head"
            viewBox="0 0 10 10"
            refX={9}
            refY={5}
            markerWidth={7}
            markerHeight={7}
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 Z" fill="var(--sim-color-border-strong)" />
          </marker>
          <marker
            id="flow-head-on"
            viewBox="0 0 10 10"
            refX={9}
            refY={5}
            markerWidth={7}
            markerHeight={7}
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 Z" fill="var(--sim-color-accent)" />
          </marker>
        </defs>

        {routed.map(({ edge, from, to, straight, back, lane }) => {
          const { key, count } = countOf(edge);
          const used = count > 0;
          const fresh = key === lastKey && duration > 0;
          const fromAddr = from.addresses.at(-1) ?? 0;
          const toAddr = to.addresses[0] ?? 0;
          let d: string;
          let labelX: number;
          let labelY: number;
          if (straight) {
            const x = BOX_X + BOX_W / 2;
            d = `M${x} ${from.y + from.h} L${x} ${to.y}`;
            labelX = x - 8;
            labelY = from.y + from.h + GAP / 2 + 4;
          } else if (back) {
            const x = BOX_X - 18 - lane * LANE;
            const y1 = lineY(from, fromAddr);
            const y2 = lineY(to, toAddr);
            d = `M${BOX_X} ${y1} L${x} ${y1} L${x} ${y2} L${BOX_X} ${y2}`;
            labelX = x - 6;
            labelY = (y1 + y2) / 2;
          } else {
            const x = BOX_X + BOX_W + 18 + lane * LANE;
            const y1 = lineY(from, fromAddr);
            const y2 = lineY(to, toAddr);
            d = `M${BOX_X + BOX_W} ${y1} L${x} ${y1} L${x} ${y2} L${BOX_X + BOX_W} ${y2}`;
            labelX = x + 6;
            labelY = (y1 + y2) / 2;
          }
          const word = edge.kind === "taken" ? "yes" : edge.kind === "not-taken" ? "no" : "";
          const label = back
            ? `↻ ×${count}`
            : [word, used ? `×${count}` : ""].filter(Boolean).join(" ");
          return (
            <g key={`${edge.from}-${edge.to}-${edge.kind}`}>
              <path
                d={d}
                fill="none"
                stroke={used ? "var(--sim-color-accent)" : "var(--sim-color-border-strong)"}
                strokeWidth={used ? 3 : 1.5}
                strokeDasharray={used ? undefined : "5 4"}
                markerEnd={used ? "url(#flow-head-on)" : "url(#flow-head)"}
              />
              {fresh && (
                <motion.path
                  key={stepId}
                  d={d}
                  fill="none"
                  stroke="var(--sim-color-accent)"
                  strokeWidth={6}
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 1 }}
                  animate={{ pathLength: 1, opacity: 0 }}
                  transition={{ duration: (duration * 2) / 1000, ease: "easeInOut" }}
                />
              )}
              {label && (
                <text
                  x={labelX}
                  y={labelY}
                  fontSize={12}
                  fontWeight={back ? 700 : 400}
                  textAnchor={back || straight ? "end" : "start"}
                  fill={back ? "var(--sim-color-branch)" : "var(--sim-color-text-muted)"}
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}

        {placed.map((p) => {
          const current = p.id === currentBlock;
          return (
            <g key={p.id}>
              <rect
                x={BOX_X}
                y={p.y}
                width={BOX_W}
                height={p.h}
                rx={8}
                fill="var(--sim-color-surface)"
                stroke={current ? "var(--sim-color-accent)" : "var(--sim-color-border-strong)"}
                strokeWidth={current ? 4 : 1.5}
              />
              {headers.has(p.id) && (
                <text
                  x={BOX_X + BOX_W - 8}
                  y={p.y - 4}
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--sim-color-branch)"
                >
                  ↻ loop starts here
                </text>
              )}
              {p.addresses.map((a, i) => {
                const label = labelAt.get(a);
                const running = started && a === here;
                return (
                  <text
                    key={a}
                    x={BOX_X + 10}
                    y={p.y + PAD + i * LINE + 15}
                    fontSize={13}
                    fontFamily="var(--font-mono)"
                    fill="var(--sim-color-text)"
                    fontWeight={running ? 700 : 400}
                  >
                    {running ? "▶ " : "  "}
                    {String(a).padStart(2, "0")} {label ? `${label}: ` : ""}
                    {withLabel(disassembleWord(program.memory[a] ?? 0, dialect), labelAt)}
                  </text>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
