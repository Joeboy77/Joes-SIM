"use client";

import type { Component, DialectId } from "@joes-sim/engine";
import { useEffect, useId } from "react";
import { RunBar } from "@/sim/controls/RunBar";
import { Editor } from "@/sim/editor/Editor";
import { ExplainPanel } from "@/sim/panels/ExplainPanel";
import { IOPanel } from "@/sim/panels/IOPanel";
import { MachinePanel } from "@/sim/panels/MachinePanel";
import { PredictPanel } from "@/sim/predict/PredictPanel";
import { SimProvider, useSim } from "@/sim/SimProvider";
import type { ViewMode } from "@/sim/store";
import { usePlaybackLoop } from "@/sim/usePlayback";
import { useLesson } from "./LessonContext";

export interface LessonSimProps {
  readonly program: string;
  readonly inputs?: string;
  readonly dialect?: DialectId;
  readonly view?: ViewMode;
  /** A part to keep highlighted, to draw attention to it. */
  readonly highlight?: Component;
  /** Start the machine paused after this many instructions. */
  readonly pauseAt?: number;
  /** Show the memory grid. */
  readonly memory?: boolean;
  /** Start with predict mode on. */
  readonly predict?: boolean;
  readonly title?: string;
}

/** A live simulator inside a lesson, set up by the lesson (brief, 7.9). */
export function LessonSim(props: LessonSimProps) {
  return (
    <SimProvider
      initial={{
        source: props.program.replace(/^\n/, ""),
        dialect: props.dialect ?? "classic",
        inputText: props.inputs ?? "",
      }}
    >
      <Inner {...props} />
    </SimProvider>
  );
}

function Inner({
  view = "datapath",
  highlight,
  pauseAt,
  memory = false,
  predict = false,
  title,
}: LessonSimProps) {
  usePlaybackLoop();
  const store = useSim();
  const { term } = useLesson();
  const id = useId();

  useEffect(() => {
    store.getState().setView(view);
    if (pauseAt) store.getState().goToCycle(pauseAt);
  }, [store, view, pauseAt]);

  useEffect(() => {
    store.getState().setHoverTerm(term ?? highlight ?? null);
  }, [store, term, highlight]);

  return (
    <section
      aria-labelledby={id}
      className="my-6 space-y-3 rounded-lg border border-border-strong bg-surface p-3"
    >
      <h3 id={id} className="font-bold">
        <span aria-hidden="true">▶ </span>
        {title ?? "Try it"}
      </h3>
      <details className="rounded-sm border border-border">
        <summary className="min-h-11 cursor-pointer px-2 py-2 text-sm font-bold">
          Show the program (you can edit it)
        </summary>
        <div className="h-56 overflow-hidden border-t border-border">
          <Editor />
        </div>
      </details>
      <div className="rounded-md border border-border">
        <RunBar />
      </div>
      <MachinePanel memory={memory} />
      {predict && <PredictPanel startOn />}
      <ExplainPanel />
      <IOPanel />
    </section>
  );
}
