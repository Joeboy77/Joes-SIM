"use client";

import { useSimState } from "../SimProvider";
import { useActivity } from "../useActivity";
import { DatapathView } from "../views/DatapathView";
import { FlowView } from "../views/FlowView";
import { MemoryGrid } from "../views/MemoryGrid";
import { StoryView } from "../views/StoryView";

export function MachinePanel({ memory = true }: { memory?: boolean }) {
  const view = useSimState((s) => s.view);
  const { activity } = useActivity();
  const b = activity.branch;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        {view === "datapath" ? <DatapathView /> : view === "story" ? <StoryView /> : <FlowView />}
      </div>
      {b && (
        <p className="rounded-sm border border-branch px-3 py-1.5 text-sm" role="note">
          <span className="font-bold text-branch">↪ Branch</span> at mailbox{" "}
          {String(b.from).padStart(2, "0")} to {String(b.target).padStart(2, "0")}:{" "}
          {b.taken ? "✓ taken, jumping there" : "✗ not taken, carrying on to the next mailbox"}
        </p>
      )}
      {memory && <MemoryGrid />}
    </div>
  );
}
