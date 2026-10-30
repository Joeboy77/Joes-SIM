"use client";

import {
  CHALLENGES,
  CONCEPT_NAMES,
  meetsTargets,
  runChallenge,
  type Challenge,
  type ChallengeResult,
  type ExpectedOutput,
  type Targets,
} from "@joes-sim/content";
import { DIALECTS } from "@joes-sim/engine";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Editor } from "@/sim/editor/Editor";
import { Hints } from "@/sim/panels/ProblemsPanel";
import { SimProvider, useSim, useSimState } from "@/sim/SimProvider";
import { handoffHref } from "@/sim/workspace/handoff";
import {
  EMPTY_CHALLENGE,
  bestOf,
  getProgress,
  updateChallenge,
  type ChallengeProgress,
} from "@/storage/progress";
import { Difficulty } from "./ChallengeList";

const show = (os: readonly ExpectedOutput[]) =>
  os.length ? os.map((o) => (typeof o === "string" ? `'${o}'` : o)).join(", ") : "nothing";

/** The model solution opens after solving, or after real effort (decision 0022). */
export function canSeeSolution(p: ChallengeProgress): boolean {
  return p.solved || p.realAttempts >= 3 || (p.hintsShown >= 3 && p.realAttempts >= 1);
}

export function ChallengeWorkbench({ id }: { id: string }) {
  const challenge = CHALLENGES.find((c) => c.id === id) as Challenge;
  return (
    <SimProvider
      initial={{
        source: challenge.starter,
        dialect: challenge.dialect,
        inputText: challenge.tests[0]?.inputs.join(", ") ?? "",
      }}
    >
      <Workbench challenge={challenge} />
    </SimProvider>
  );
}

function Workbench({ challenge }: { challenge: Challenge }) {
  const store = useSim();
  const source = useSimState((s) => s.source);
  const [progress, setProgress] = useState<ChallengeProgress | null>(null);
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const [runId, setRunId] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const loaded = useRef(false);

  // Restore the learner's draft and progress.
  useEffect(() => {
    void getProgress()
      .then((p) => {
        const c = p.challenges[challenge.id] ?? EMPTY_CHALLENGE;
        if (c.draft !== null) store.getState().setSource(c.draft);
        setProgress(c);
        setShowSolution(c.solutionSeen);
      })
      .catch(() => setProgress(EMPTY_CHALLENGE))
      .finally(() => {
        loaded.current = true;
      });
  }, [challenge.id, store]);

  // Save the draft a moment after each change.
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      void updateChallenge(challenge.id, (c) => ({ ...c, draft: source })).catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [source, challenge.id]);

  const runTests = async () => {
    const r = runChallenge(source, challenge);
    setResult(r);
    setRunId((n) => n + 1);
    const changed = source.trim() !== challenge.starter.trim();
    const p = await updateChallenge(challenge.id, (c) => ({
      ...c,
      draft: source,
      attempts: c.attempts + 1,
      realAttempts: c.realAttempts + (changed && r.errors.length === 0 ? 1 : 0),
      solved: c.solved || r.passed,
      best: r.scores ? bestOf(c.best, r.scores) : c.best,
    })).catch(() => null);
    if (p) setProgress(p.challenges[challenge.id] ?? EMPTY_CHALLENGE);
  };

  const p = progress ?? EMPTY_CHALLENGE;
  const solutionOpen = canSeeSolution(p);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm">
          <Link href="/challenges" className="text-accent underline">
            All challenges
          </Link>
        </p>
        <h1 className="text-3xl font-bold">{challenge.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Difficulty level={challenge.difficulty} />
          {challenge.kind === "bug-hunt" && <span className="font-bold text-danger">Bug hunt</span>}
          <span>{challenge.concepts.map((c) => CONCEPT_NAMES[c]).join(", ")}</span>
          <span>· {DIALECTS[challenge.dialect].name} dialect</span>
          {p.solved && <span className="font-bold text-success">· ✓ Solved</span>}
        </div>
        <p className="max-w-2xl text-lg">{challenge.description}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-bold">Your program</h2>
          <div className="h-80 overflow-hidden rounded-md border border-border">
            <Editor />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runTests()}
              className="min-h-11 rounded-md bg-accent px-4 font-bold text-on-accent"
            >
              Run the tests
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Go back to the starting program? Your changes will be lost.")) {
                  store.getState().setSource(challenge.starter);
                  setResult(null);
                }
              }}
              className="min-h-11 rounded-md border border-border-strong px-4"
            >
              Start again
            </button>
          </div>

          <section aria-labelledby="tests-h" className="space-y-2">
            <h2 id="tests-h" className="font-bold">
              Tests
            </h2>
            {!result ? (
              <ul className="space-y-1 text-sm">
                {challenge.tests.map((t, i) => (
                  <li key={i} className="rounded-sm border border-border p-2">
                    Test {i + 1}: inputs {t.inputs.length ? t.inputs.join(", ") : "none"} → expects{" "}
                    {show(t.outputs)}
                  </li>
                ))}
              </ul>
            ) : (
              <Results key={runId} challenge={challenge} result={result} source={source} />
            )}
          </section>
        </div>

        <div className="space-y-6">
          <Scores
            targets={challenge.targets}
            best={p.best}
            latest={result?.scores ?? null}
            runId={runId}
          />
          <section aria-labelledby="hints-h" className="space-y-2">
            <h2 id="hints-h" className="font-bold">
              Hints
            </h2>
            {progress && (
              <Hints
                hints={challenge.hints}
                initial={p.hintsShown}
                onReveal={(n) =>
                  void updateChallenge(challenge.id, (c) => ({
                    ...c,
                    hintsShown: Math.max(c.hintsShown, n),
                  }))
                    .then((x) => setProgress(x.challenges[challenge.id] ?? EMPTY_CHALLENGE))
                    .catch(() => undefined)
                }
              />
            )}
          </section>
          <section aria-labelledby="solution-h" className="space-y-2">
            <h2 id="solution-h" className="font-bold">
              Model solution
            </h2>
            {showSolution ? (
              <pre className="overflow-auto rounded-md border border-border bg-surface-2 p-3 font-mono text-sm">
                {challenge.solution}
              </pre>
            ) : solutionOpen ? (
              <button
                type="button"
                onClick={() => {
                  setShowSolution(true);
                  void updateChallenge(challenge.id, (c) => ({ ...c, solutionSeen: true })).catch(
                    () => undefined,
                  );
                }}
                className="min-h-11 rounded-md border border-border-strong px-4"
              >
                Show the model solution
              </button>
            ) : (
              <p className="text-sm text-muted">
                The model solution opens once you have solved the challenge, or tried three
                different versions of your own (or seen all the hints and tried once). You have
                tried {p.realAttempts} so far.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Results({
  challenge,
  result,
  source,
}: {
  challenge: Challenge;
  result: ChallengeResult;
  source: string;
}) {
  const reduced = useReducedMotion() ?? false;
  if (result.errors.length) {
    return (
      <div role="alert" className="rounded-sm border border-danger p-2 text-sm">
        <p className="font-bold text-danger">The program has errors, so the tests did not run.</p>
        <ul className="list-disc pl-5">
          {result.errors.map((e, i) => (
            <li key={i}>
              Line {e.line}: {e.message}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const passed = result.results.filter((r) => r.pass).length;
  const delay = (i: number) => (reduced ? 0 : 0.15 * i);
  return (
    <div className="space-y-2">
      <ul className="space-y-1 text-sm">
        {result.results.map((r, i) => (
          <motion.li
            key={i}
            initial={reduced ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay(i), duration: 0.2 }}
            className={`rounded-sm border-2 p-2 ${r.pass ? "border-success" : "border-danger"}`}
          >
            <p className="font-bold">
              <span className={r.pass ? "text-success" : "text-danger"}>
                {r.pass ? "✓ Pass" : "✗ Fail"}
              </span>
              {": "}test {i + 1}, inputs {r.test.inputs.length ? r.test.inputs.join(", ") : "none"}
            </p>
            <p>{r.explanation}</p>
            {r.difference && (
              <a
                href={handoffHref({
                  name: `${challenge.title}, test ${i + 1}`,
                  source,
                  dialect: challenge.dialect,
                  inputs: r.test.inputs.join(", "),
                  cycle: r.difference.cycle,
                })}
                className="mt-1 inline-block min-h-11 py-2 font-bold text-accent underline"
              >
                Open in the simulator at step {r.difference.cycle}
              </a>
            )}
          </motion.li>
        ))}
      </ul>
      <motion.p
        role="status"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay(result.results.length) }}
        className="flex items-center gap-2 font-bold"
      >
        {result.passed ? (
          <>
            <SuccessMark reduced={reduced} delay={delay(result.results.length)} />
            <span className="text-success">All {passed} tests pass. Well done!</span>
          </>
        ) : (
          <span>
            {passed} of {result.results.length} tests pass.
          </span>
        )}
      </motion.p>
    </div>
  );
}

/** A brief, quiet tick that draws itself when every test passes. */
function SuccessMark({ reduced, delay }: { reduced: boolean; delay: number }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <circle
        cx="14"
        cy="14"
        r="12"
        fill="none"
        stroke="var(--sim-color-success)"
        strokeWidth="2.5"
      />
      <motion.path
        d="M8 14.5 L12.5 19 L20 10"
        fill="none"
        stroke="var(--sim-color-success)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay, duration: 0.5, ease: "easeOut" }}
      />
    </svg>
  );
}

const MEASURES: { key: keyof Targets; label: string }[] = [
  { key: "instructions", label: "Instructions" },
  { key: "cycles", label: "Steps on the longest test" },
  { key: "mailboxes", label: "Mailboxes used" },
];

/** Each score on a small bar, with the target marked (brief, 7.8). */
function Scores({
  targets,
  best,
  latest,
  runId,
}: {
  targets: Targets;
  best: Targets | null;
  latest: Targets | null;
  runId: number;
}) {
  const reduced = useReducedMotion() ?? false;
  const shown = latest ?? best;
  const met = shown ? meetsTargets(shown, targets) : null;
  return (
    <section aria-labelledby="scores-h" className="space-y-2">
      <h2 id="scores-h" className="font-bold">
        Scores
      </h2>
      {!shown ? (
        <p className="text-sm text-muted">
          Pass every test to get a score. Targets: {targets.instructions} instructions,{" "}
          {targets.cycles} steps, {targets.mailboxes} mailboxes. Lower is better.
        </p>
      ) : (
        <ul className="space-y-3 text-sm">
          {MEASURES.map(({ key, label }) => {
            const score = shown[key];
            const target = targets[key];
            const scale = Math.max(score, target) * 1.15;
            const ok = met?.[key];
            return (
              <li key={key}>
                <p>
                  {label}: <span className="font-bold">{score}</span> (target {target}){" "}
                  <span className={ok ? "text-success" : "text-write"}>
                    {ok ? "✓ target met" : `${score - target} over the target`}
                  </span>
                  {best && latest && best[key] < latest[key] && (
                    <span className="text-muted"> · your best is {best[key]}</span>
                  )}
                </p>
                <div className="relative mt-1 h-3 rounded-full bg-surface-2" aria-hidden="true">
                  <motion.div
                    key={runId}
                    className={`h-3 rounded-full ${ok ? "bg-success" : "bg-write"}`}
                    initial={reduced ? false : { width: 0 }}
                    animate={{ width: `${(score / scale) * 100}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                  <div
                    className="absolute -top-1 h-5 w-0.5 bg-text"
                    style={{ left: `${(target / scale) * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
          <li className="text-xs text-muted">The black line marks each target. Lower is better.</li>
        </ul>
      )}
    </section>
  );
}
