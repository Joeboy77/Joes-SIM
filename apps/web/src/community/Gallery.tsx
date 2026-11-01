"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { decodeShare } from "@/sim/workspace/share";
import {
  CommunityError,
  communityOn,
  deleteProgram,
  listPrograms,
  reportProgram,
  type GalleryMachine,
  type Published,
} from "./client";

const MACHINE_NAMES: Record<GalleryMachine, string> = {
  classic: "Classic LMC",
  extended: "Extended machine",
  multicore: "Multicore machine",
};

const message = (e: unknown) =>
  e instanceof CommunityError ? e.message : "Something went wrong. Please try again.";

const dateText = (ms: number) =>
  new Date(ms).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });

/** The public gallery of programs learners chose to publish (Phase 11). */
export function Gallery() {
  const [machine, setMachine] = useState<GalleryMachine | null>(null);
  const [programs, setPrograms] = useState<Published[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);
  const filterId = useId();

  // Callers set `loading` first; the first page starts out loading.
  const load = useCallback(async (m: GalleryMachine | null, before: string | null) => {
    try {
      const page = await listPrograms(m, before);
      setPrograms((old) => (before ? [...old, ...page.programs] : page.programs));
      setNext(page.next);
      setError("");
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!communityOn) return;
    // The address names a program just published: show it first.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlight(new URLSearchParams(window.location.search).get("program"));
  }, []);
  useEffect(() => {
    if (!communityOn) return;
    // The page arrives later, so this is not a synchronous update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(machine, null);
  }, [load, machine]);

  if (!communityOn) {
    return (
      <p className="rounded-md border border-border bg-surface p-3">
        The gallery is not switched on for this copy of Joe&apos;s SIM. Everything else works as
        usual, and you can still share programs as links or files.
      </p>
    );
  }

  const shown = highlight
    ? [...programs].sort((a, b) => Number(b.id === highlight) - Number(a.id === highlight))
    : programs;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={filterId} className="text-sm">
          Machine
        </label>
        <select
          id={filterId}
          value={machine ?? ""}
          onChange={(e) => {
            setLoading(true);
            setMachine((e.target.value || null) as GalleryMachine | null);
          }}
          className="min-h-11 rounded-sm border border-border-strong bg-surface px-2 text-sm"
        >
          <option value="">All machines</option>
          {(Object.keys(MACHINE_NAMES) as GalleryMachine[]).map((m) => (
            <option key={m} value={m}>
              {MACHINE_NAMES[m]}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <p role="status" className="min-h-5 text-sm text-success">
        {status}
      </p>
      {!loading && !error && programs.length === 0 && (
        <p className="text-muted">
          No programs here yet. Publish one from the simulator&apos;s <strong>Share</strong> button.
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2" aria-label="Published programs">
        {shown.map((p) => (
          <Card
            key={p.id}
            program={p}
            highlighted={p.id === highlight}
            onGone={(text) => {
              setPrograms((old) => old.filter((x) => x.id !== p.id));
              setStatus(text);
            }}
            onStatus={(text) => {
              setStatus(text);
              setError("");
            }}
            onError={(text) => setError(text)}
          />
        ))}
      </ul>
      {next && (
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            void load(machine, next);
          }}
          className="min-h-11 rounded-md border border-border-strong px-4 font-bold"
        >
          {loading ? "Loading…" : "Show older programs"}
        </button>
      )}
    </div>
  );
}

function Card({
  program: p,
  highlighted,
  onGone,
  onStatus,
  onError,
}: {
  program: Published;
  highlighted: boolean;
  onGone: (status: string) => void;
  onStatus: (status: string) => void;
  onError: (error: string) => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const reasonId = useId();
  const headingId = useId();
  const preview =
    decodeShare(p.p)
      ?.source.split("\n")
      .filter((l) => l.trim())
      .slice(0, 4) ?? [];

  return (
    <li
      aria-labelledby={headingId}
      className={`space-y-2 rounded-md border bg-surface p-3 ${highlighted ? "border-2 border-accent" : "border-border"}`}
    >
      <h2 id={headingId} className="font-bold break-words">
        {p.title}
      </h2>
      <p className="text-sm text-muted">
        by {p.nickname} · {MACHINE_NAMES[p.machine]} · {dateText(p.created)}
      </p>
      {p.description && <p className="text-sm break-words">{p.description}</p>}
      <pre className="overflow-x-auto rounded-sm bg-surface-2 p-2 text-xs" aria-hidden="true">
        {preview.join("\n")}
      </pre>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={`/sim?p=${p.p}`}
          className="inline-flex min-h-11 items-center rounded-md bg-accent px-3 font-bold text-on-accent"
        >
          Open<span className="sr-only"> {p.title}</span> in the simulator
        </Link>
        {p.mine ? (
          <button
            type="button"
            className="min-h-11 rounded-md border border-border-strong px-3"
            onClick={async () => {
              if (!window.confirm(`Delete “${p.title}” from the gallery?`)) return;
              try {
                await deleteProgram(p.id);
                onGone(`“${p.title}” is deleted.`);
              } catch (e) {
                onError(message(e));
              }
            }}
          >
            Delete<span className="sr-only"> {p.title}</span>
          </button>
        ) : (
          <button
            type="button"
            aria-expanded={reporting}
            className="min-h-11 rounded-md border border-border-strong px-3"
            onClick={() => setReporting((r) => !r)}
          >
            Report<span className="sr-only"> {p.title}</span>
          </button>
        )}
      </div>
      {reporting && (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const r = await reportProgram(p.id, reason.trim());
              setReporting(false);
              if (r.hidden) onGone("Thank you. The program is hidden until a moderator checks it.");
              else onStatus("Thank you. A moderator will look at it.");
            } catch (err) {
              onError(message(err));
            }
          }}
        >
          <label htmlFor={reasonId} className="block text-sm font-bold">
            What is wrong with it? (optional)
          </label>
          <input
            id={reasonId}
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-11 w-full rounded-sm border border-border-strong bg-surface px-2"
          />
          <button
            type="submit"
            className="min-h-11 rounded-md border border-danger px-3 font-bold text-danger"
          >
            Send report
          </button>
        </form>
      )}
    </li>
  );
}
