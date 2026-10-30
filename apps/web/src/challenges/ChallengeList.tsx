"use client";

import { CHALLENGES, CONCEPTS, CONCEPT_NAMES, type Concept } from "@joes-sim/content";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { EMPTY_PROGRESS, getProgress, type Progress } from "@/storage/progress";

export function Difficulty({ level }: { level: number }) {
  return (
    <span className="whitespace-nowrap text-sm">
      <span aria-hidden="true" className="text-accent">
        {"●".repeat(level)}
        <span className="text-border-strong">{"○".repeat(5 - level)}</span>
      </span>
      <span className="sr-only">Difficulty {level} of 5</span>
    </span>
  );
}

/** Every challenge, with filters, and a tick on the ones solved on this device. */
export function ChallengeList() {
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [concept, setConcept] = useState<Concept | "all">("all");
  const [kind, setKind] = useState<"all" | "build" | "bug-hunt">("all");
  const conceptId = useId();
  const kindId = useId();

  useEffect(() => {
    void getProgress()
      .then(setProgress)
      .catch(() => undefined);
  }, []);

  const shown = CHALLENGES.filter(
    (c) =>
      (concept === "all" || c.concepts.includes(concept)) && (kind === "all" || c.kind === kind),
  );
  const solved = CHALLENGES.filter((c) => progress.challenges[c.id]?.solved).length;

  return (
    <div className="space-y-4">
      <p className="text-muted">
        {solved} of {CHALLENGES.length} solved on this device.
      </p>
      <div className="flex flex-wrap gap-4">
        <div>
          <label htmlFor={conceptId} className="block text-sm text-muted">
            Topic
          </label>
          <select
            id={conceptId}
            value={concept}
            onChange={(e) => setConcept(e.target.value as Concept | "all")}
            className="min-h-11 rounded-sm border border-border-strong bg-surface px-2"
          >
            <option value="all">All topics</option>
            {CONCEPTS.map((c) => (
              <option key={c} value={c}>
                {CONCEPT_NAMES[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={kindId} className="block text-sm text-muted">
            Kind
          </label>
          <select
            id={kindId}
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className="min-h-11 rounded-sm border border-border-strong bg-surface px-2"
          >
            <option value="all">All kinds</option>
            <option value="build">Build a program</option>
            <option value="bug-hunt">Bug hunts</option>
          </select>
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((c) => {
          const done = progress.challenges[c.id]?.solved;
          return (
            <li key={c.id} className="rounded-md border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/challenges/${c.id}`}
                  className="font-bold text-accent underline-offset-4 hover:underline"
                >
                  {c.title}
                </Link>
                {done && (
                  <span className="text-sm font-bold text-success">
                    <span aria-hidden="true">✓ </span>Solved
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm">{c.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                <Difficulty level={c.difficulty} />
                {c.kind === "bug-hunt" && (
                  <span className="rounded-sm border border-danger px-1 text-danger">Bug hunt</span>
                )}
                {c.concepts
                  .filter((t) => t !== "debugging")
                  .map((t) => (
                    <span key={t} className="rounded-sm border border-border px-1">
                      {CONCEPT_NAMES[t]}
                    </span>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && <p className="text-muted">No challenges match these filters.</p>}
    </div>
  );
}
