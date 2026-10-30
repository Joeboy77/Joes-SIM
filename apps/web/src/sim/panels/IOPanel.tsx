"use client";

import { formatValue } from "@joes-sim/engine";
import { useEffect, useId, useRef, useState } from "react";
import { useSim, useSimState } from "../SimProvider";
import { parseInputs } from "../store";

export function IOPanel() {
  const store = useSim();
  const inputText = useSimState((s) => s.inputText);
  const inputError = useSimState((s) => s.inputError);
  const state = useSimState((s) => s.state);
  const dialect = useSimState((s) => s.dialect);
  const inputsId = useId();
  const askId = useId();
  const [draft, setDraft] = useState("");
  const [askError, setAskError] = useState<string | null>(null);
  const askRef = useRef<HTMLInputElement>(null);
  const waiting = state?.status === "waiting-input";

  useEffect(() => {
    if (waiting) askRef.current?.focus();
  }, [waiting]);

  const give = () => {
    const parsed = parseInputs(draft, dialect);
    const value = parsed.values[0];
    if (parsed.error || value === undefined || parsed.values.length !== 1) {
      setAskError(parsed.error ?? "Type one whole number.");
      return;
    }
    setAskError(null);
    setDraft("");
    store.getState().provideInput(value);
  };

  const consumed = state?.inputIndex ?? 0;
  const queue = state?.inputs ?? [];

  return (
    <section aria-labelledby={`${inputsId}-h`} className="space-y-4">
      <div>
        <h2 id={`${inputsId}-h`} className="mb-1 text-sm font-bold">
          Inputs
        </h2>
        <label htmlFor={inputsId} className="mb-1 block text-xs text-muted">
          Values for INP to read, in order, separated by commas or spaces
        </label>
        <input
          id={inputsId}
          value={inputText}
          onChange={(e) => store.getState().setInputText(e.target.value)}
          aria-invalid={inputError ? true : undefined}
          aria-describedby={inputError ? `${inputsId}-err` : undefined}
          className="min-h-11 w-full rounded-sm border border-border-strong bg-surface px-2 font-mono text-text"
          inputMode="text"
        />
        {inputError ? (
          <p id={`${inputsId}-err`} className="mt-1 text-sm text-danger">
            ⚠ {inputError}
          </p>
        ) : null}
        {queue.length > 0 && (
          <p
            className="mt-2 font-mono text-sm"
            aria-label={`Inputs: ${consumed} of ${queue.length} read`}
          >
            {queue.map((v, i) => (
              <span key={i} className={i < consumed ? "mr-2 text-muted line-through" : "mr-2"}>
                {formatValue(v)}
              </span>
            ))}
          </p>
        )}
      </div>

      {waiting && (
        <div role="alert" className="rounded-md border-2 border-read p-3">
          <p className="mb-2 text-sm font-bold">
            The Little Man is waiting at the in-tray for a value.
          </p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              give();
            }}
          >
            <label htmlFor={askId} className="sr-only">
              Input value
            </label>
            <input
              id={askId}
              ref={askRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              inputMode="numeric"
              aria-invalid={askError ? true : undefined}
              className="min-h-11 w-28 rounded-sm border border-border-strong bg-surface px-2 font-mono text-text"
            />
            <button
              type="submit"
              className="min-h-11 rounded-md bg-accent px-3 font-bold text-on-accent"
            >
              Give input
            </button>
          </form>
          {askError ? <p className="mt-1 text-sm text-danger">⚠ {askError}</p> : null}
        </div>
      )}

      <div>
        <h2 className="mb-1 text-sm font-bold">Output</h2>
        {state && state.outputs.length > 0 ? (
          <ol className="flex flex-wrap gap-2 font-mono" aria-label="Output values">
            {state.outputs.map((o, i) => (
              <li key={i} className="rounded-sm border border-border bg-surface-2 px-2 py-1">
                {o.kind === "char" ? (o.char === "\n" ? "↵" : o.char) : formatValue(o.value)}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">Nothing output yet.</p>
        )}
      </div>
    </section>
  );
}
