"use client";

import { narrate, type Level, type Segment } from "@joes-sim/narration";
import { useMemo } from "react";
import { useSim, useSimState } from "../SimProvider";
import { useActivity } from "../useActivity";

const LEVELS: { id: Level; label: string }[] = [
  { id: "beginner", label: "Beginner" },
  { id: "technical", label: "Technical" },
];

/** Plain-language narration of the last action (brief, 7.1). */
export function ExplainPanel() {
  const store = useSim();
  const state = useSimState((s) => s.state);
  const lastSteps = useSimState((s) => s.lastSteps);
  const direction = useSimState((s) => s.direction);
  const level = useSimState((s) => s.level);
  const playing = useSimState((s) => s.playing);
  const speed = useSimState((s) => s.speed);
  const { activity } = useActivity();

  const sentences = useMemo(() => {
    if (!state) return [];
    if (direction === "forward") return narrate(lastSteps, state, { level }).map((n) => n.segments);
    const where = state.microSteps === 0 ? "the start" : `step ${state.cycles}`;
    const text =
      direction === "back" || direction === "jump"
        ? `You went back to ${where}. Step forward to see what happens next.`
        : "Press Step to see what the Little Man does first.";
    return [[{ text }] as Segment[]];
  }, [state, lastSteps, direction, level]);

  // Announce only when the learner can keep up: paused, or stepping slowly.
  const announce = !playing || speed === "slow" || speed === "manual";
  const plain = sentences.map((s) => s.map((x) => x.text).join("")).join(" ");

  return (
    <section aria-labelledby="explain-h" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="explain-h" className="text-sm font-bold">
          What just happened
        </h2>
        <div role="group" aria-label="Explanation level" className="flex gap-1">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={level === l.id}
              onClick={() => store.getState().setLevel(l.id)}
              className={`min-h-11 rounded-sm border px-3 text-sm ${level === l.id ? "border-accent bg-accent font-bold text-on-accent" : "border-border-strong bg-surface"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
      {state ? (
        <div className="space-y-2 rounded-md border border-border bg-surface p-3 text-base leading-relaxed">
          {sentences.map((segments, i) => (
            <p key={i}>
              {segments.map((seg, j) =>
                "term" in seg ? (
                  <span
                    key={j}
                    data-term={seg.term}
                    onPointerEnter={() => store.getState().setHoverTerm(seg.term)}
                    onPointerLeave={() => store.getState().setHoverTerm(null)}
                    className={`rounded-sm underline decoration-dotted underline-offset-4 ${activity.active.has(seg.term) ? "bg-surface-2 font-bold text-accent" : ""}`}
                  >
                    {seg.text}
                  </span>
                ) : (
                  <span key={j}>{seg.text}</span>
                ),
              )}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Fix the errors in your program to see what it does.</p>
      )}
      <p className="sr-only" aria-live="polite">
        {announce ? plain : ""}
      </p>
    </section>
  );
}
