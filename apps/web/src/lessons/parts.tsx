"use client";

import type { Component } from "@joes-sim/engine";
import { useId, useState, type ReactNode } from "react";
import { useLesson } from "./LessonContext";

/** A word naming a machine part. Pointing at it highlights that part in the lesson's simulators. */
export function Highlight({ component, children }: { component: Component; children: ReactNode }) {
  const { setTerm } = useLesson();
  return (
    <span
      tabIndex={0}
      onPointerEnter={() => setTerm(component)}
      onPointerLeave={() => setTerm(null)}
      onFocus={() => setTerm(component)}
      onBlur={() => setTerm(null)}
      className="rounded-sm font-bold text-branch underline decoration-dotted underline-offset-4"
    >
      {children}
    </span>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <aside className="my-4 max-w-prose rounded-md border-s-4 border-accent bg-surface-2 p-3">
      {children}
    </aside>
  );
}

/** A question to answer before reading on. The answer and the reason appear once chosen. */
export function Predict({
  question,
  choices,
  answer,
  explain,
}: {
  question: string;
  choices: readonly string[];
  answer: string;
  explain: string;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="my-6 max-w-prose rounded-md border-2 border-branch p-4"
    >
      <h3 id={id} className="mb-2 font-bold">
        <span aria-hidden="true">🤔 </span>Predict: {question}
      </h3>
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={picked === c}
            onClick={() => setPicked(c)}
            className={`min-h-11 rounded-sm border px-3 ${picked === c ? (c === answer ? "border-success border-2 font-bold" : "border-danger border-2 font-bold") : "border-border-strong bg-surface"}`}
          >
            {c}
          </button>
        ))}
      </div>
      {picked !== null && (
        <p role="status" className="mt-3">
          <span className={`font-bold ${picked === answer ? "text-success" : "text-danger"}`}>
            {picked === answer ? "✓ Yes." : `✗ Not quite: the answer is ${answer}.`}
          </span>{" "}
          {explain}
        </p>
      )}
    </section>
  );
}
