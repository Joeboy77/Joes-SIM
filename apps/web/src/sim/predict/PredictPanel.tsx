"use client";

import { narrateInstruction } from "@joes-sim/narration";
import { motion, useReducedMotion } from "motion/react";
import { useId, useMemo, useState } from "react";
import { recordPrediction } from "@/storage/progress";
import { useSim, useSimState } from "../SimProvider";
import { isCorrect, questionFor, showAnswer, type Question } from "./questions";

interface Feedback {
  readonly question: Question;
  readonly correct: boolean;
  readonly why: string;
}

/** Predict before you step (brief, 7.7). Answers are counted on this device only. */
export function PredictPanel({ startOn = false }: { startOn?: boolean }) {
  const store = useSim();
  const predictId = useId();
  const state = useSimState((s) => s.state);
  const level = useSimState((s) => s.level);
  const [on, setOn] = useState(startOn);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [session, setSession] = useState({ total: 0, correct: 0 });
  const reduced = useReducedMotion() ?? false;
  const inputId = useId();
  const question = useMemo(() => (state && on ? questionFor(state) : null), [state, on]);

  const submit = (given: string | boolean) => {
    if (!question) return;
    const correct = isCorrect(question, given);
    void recordPrediction(question.kind, correct).catch(() => undefined);
    setSession((s) => ({ total: s.total + 1, correct: s.correct + (correct ? 1 : 0) }));
    store.getState().stepInstruction();
    const after = store.getState();
    const why = after.state
      ? narrateInstruction(after.lastSteps, after.state, { level })?.text
      : null;
    setFeedback({ question, correct, why: why ?? "" });
    setAnswer("");
  };

  return (
    <section aria-labelledby={predictId} className="space-y-2 rounded-md border border-branch p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={predictId} className="text-sm font-bold">
          Predict mode
        </h2>
        <button
          type="button"
          aria-pressed={on}
          onClick={() => {
            setOn(!on);
            setFeedback(null);
          }}
          className={`min-h-11 rounded-sm border px-3 text-sm ${on ? "border-accent bg-accent font-bold text-on-accent" : "border-border-strong bg-surface"}`}
        >
          {on ? "Predicting" : "Predict each step"}
        </button>
      </div>
      {!on && (
        <p className="text-sm text-muted">
          Guess what each instruction will do before it runs. Guessing first is one of the best ways
          to learn.
        </p>
      )}
      {on && feedback && (
        <motion.div
          key={session.total}
          initial={reduced ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          role="status"
          className="text-sm"
        >
          <p className={`font-bold ${feedback.correct ? "text-success" : "text-danger"}`}>
            {feedback.correct
              ? "✓ Right!"
              : `✗ Not quite: the answer was ${showAnswer(feedback.question)}.`}
          </p>
          {feedback.why && <p>{feedback.why}</p>}
        </motion.div>
      )}
      {on && question && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (answer.trim() !== "") submit(answer);
          }}
        >
          <p className="font-bold">{question.prompt}</p>
          {question.input === "yes-no" ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => submit(true)}
                className="min-h-11 rounded-sm border border-border-strong bg-surface px-4"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => submit(false)}
                className="min-h-11 rounded-sm border border-border-strong bg-surface px-4"
              >
                No
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor={inputId} className="block text-xs text-muted">
                  Your prediction
                </label>
                <input
                  id={inputId}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  inputMode={question.input === "number" ? "numeric" : "text"}
                  maxLength={question.input === "character" ? 1 : 5}
                  autoComplete="off"
                  className="min-h-11 w-28 rounded-sm border border-border-strong bg-surface px-2 font-mono"
                />
              </div>
              <button className="min-h-11 rounded-sm bg-accent px-3 font-bold text-on-accent">
                Check and step
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              store.getState().stepInstruction();
              setFeedback(null);
            }}
            className="min-h-11 text-sm text-muted underline"
          >
            Skip this one
          </button>
        </form>
      )}
      {on && !question && state && (
        <p className="text-sm text-muted">
          {state.status === "waiting-input"
            ? "Give the machine an input to carry on."
            : state.stage !== 0
              ? "Finish this instruction to predict the next one."
              : state.status === "ready"
                ? "This INP needs an input you have not typed in yet."
                : "The program has stopped. Reset to predict again."}
        </p>
      )}
      {on && session.total > 0 && (
        <p className="text-xs text-muted">
          This time: {session.correct} of {session.total} right. Your overall accuracy is on the
          Progress page.
        </p>
      )}
    </section>
  );
}
