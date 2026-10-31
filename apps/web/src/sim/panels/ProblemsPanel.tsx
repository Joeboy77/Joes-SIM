"use client";

import { useId, useState } from "react";
import { useSim, useSimState } from "../SimProvider";
import { useRuntimeFindings } from "../useRuntimeFindings";

interface Item {
  readonly key: string;
  readonly tone: "error" | "warning" | "info";
  readonly title: string;
  readonly explanation: string;
  readonly hints?: readonly [string, string, string];
  readonly cause?: { readonly cycle: number; readonly label: string };
}

const ICON = { error: "✖", warning: "⚠", info: "ℹ" } as const;
const TIER = ["Nudge", "Pointer", "Exact cause"] as const;

/** Hints in three tiers: the learner chooses when to see more (brief, 7.6). */
export function Hints({
  hints,
  initial = 0,
  onReveal,
}: {
  hints: readonly [string, string, string];
  /** Hints already seen, for example in an earlier visit. */
  initial?: number;
  onReveal?: (shown: number) => void;
}) {
  const [shown, setShown] = useState(initial);
  return (
    <div className="mt-1 space-y-1">
      {hints.slice(0, shown).map((h, i) => (
        <p key={i} className="border-s-4 border-branch ps-2">
          <span className="font-bold">{TIER[i]}:</span> {h}
        </p>
      ))}
      {shown < 3 && (
        <button
          type="button"
          onClick={() => {
            setShown(shown + 1);
            onReveal?.(shown + 1);
          }}
          className="min-h-11 rounded-sm border border-border-strong bg-surface px-3 text-sm"
        >
          {shown === 0 ? "Show a hint" : "Show more"}
        </button>
      )}
    </div>
  );
}

export function ProblemsPanel() {
  const store = useSim();
  const problemsId = useId();
  const diagnostics = useSimState((s) => s.assembled.diagnostics);
  const findings = useSimState((s) => s.findings);
  const runtime = useRuntimeFindings();

  const items: Item[] = [
    ...diagnostics.map((d, i) => ({
      key: `d${i}-${d.code}`,
      tone: d.severity,
      title: `${d.severity === "error" ? "Error" : "Warning"} on line ${d.line}: ${d.message}`,
      explanation: d.explanation,
    })),
    ...runtime.map((f) => ({
      key: `r-${f.code}`,
      tone: f.severity,
      title: `${f.severity === "error" ? "Error" : f.severity === "warning" ? "Check" : "Note"}${f.line ? ` line ${f.line}` : ""}: ${f.message}`,
      explanation: f.explanation,
      hints: f.hints,
      ...(f.cause ? { cause: f.cause } : {}),
    })),
    ...findings.map((f, i) => ({
      key: `f${i}-${f.code}`,
      tone: f.severity,
      title: `${f.severity === "warning" ? "Check" : "Note"}${f.line ? ` line ${f.line}` : ""}: ${f.message}`,
      explanation: f.explanation,
      hints: f.hints,
    })),
  ];

  return (
    <section aria-labelledby={problemsId}>
      <h2 id={problemsId} className="mb-1 text-sm font-bold">
        Problems and hints {items.length ? `(${items.length})` : ""}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">✓ No problems found.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.key} className="rounded-sm border border-border p-2">
              <p className={item.tone === "error" ? "font-bold text-danger" : "font-bold"}>
                <span aria-hidden="true">{ICON[item.tone]} </span>
                {item.title}
              </p>
              <p className="text-muted">{item.explanation}</p>
              {item.cause && (
                <button
                  type="button"
                  onClick={() => item.cause && store.getState().jumpToCycle(item.cause.cycle)}
                  className="mt-1 min-h-11 rounded-sm border border-accent bg-surface px-3 text-sm font-bold text-accent"
                >
                  ⏮ {item.cause.label}
                </button>
              )}
              {item.hints && <Hints hints={item.hints} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
