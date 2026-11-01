"use client";

import { useSimState } from "../SimProvider";
import { ExtendedPanel } from "../extended/ExtendedPanel";
import { CoresDatapath, CoresStory, MulticorePanel } from "../multicore/MulticoreViews";
import { useActivity } from "../useActivity";
import { DatapathView } from "../views/DatapathView";
import { CacheView } from "../views/CacheView";
import { FlowView } from "../views/FlowView";
import { MemoryGrid } from "../views/MemoryGrid";
import { PipelineView } from "../views/PipelineView";
import { StoryView } from "../views/StoryView";

const pad = (n: number) => String(n).padStart(2, "0");

export function MachinePanel({ memory = true }: { memory?: boolean }) {
  const view = useSimState((s) => s.view);
  const multi = useSimState((s) => s.state?.multi !== undefined);
  const { activity } = useActivity();
  const b = activity.branch;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        {multi && view === "datapath" ? (
          <CoresDatapath />
        ) : multi && view === "story" ? (
          <CoresStory />
        ) : multi && (view === "pipeline" || view === "cache") ? (
          <p className="p-3 text-sm text-muted">
            The {view} view shows a single core. Switch the machine to Classic or Extended to use
            it.
          </p>
        ) : view === "datapath" ? (
          <DatapathView />
        ) : view === "story" ? (
          <StoryView />
        ) : view === "flow" ? (
          <FlowView />
        ) : view === "pipeline" ? (
          <PipelineView />
        ) : (
          <CacheView />
        )}
      </div>
      {b && (
        <p className="rounded-sm border border-branch px-3 py-1.5 text-sm" role="note">
          {b.kind === "call" ? (
            <>
              <span className="font-bold text-branch">↪ Call</span> from mailbox {pad(b.from)} to
              the subroutine at {pad(b.target)}. The return address is on the stack.
            </>
          ) : b.kind === "return" ? (
            <>
              <span className="font-bold text-branch">↩ Return</span> from mailbox {pad(b.from)}{" "}
              back to the caller at {pad(b.target)}.
            </>
          ) : b.kind === "interrupt" ? (
            <>
              <span className="font-bold text-branch">⚡ Interrupt</span>: the main program stops
              before mailbox {pad(b.from)}; the handler at {pad(b.target)} runs.
            </>
          ) : (
            <>
              <span className="font-bold text-branch">↪ Branch</span> at mailbox {pad(b.from)} to{" "}
              {pad(b.target)}:{" "}
              {b.taken ? "✓ taken, jumping there" : "✗ not taken, carrying on to the next mailbox"}
            </>
          )}
        </p>
      )}
      <ExtendedPanel />
      <MulticorePanel />
      {memory && <MemoryGrid />}
    </div>
  );
}
