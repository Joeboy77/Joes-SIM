import type { Metadata } from "next";

export const metadata: Metadata = { title: "Simulator" };

export default function SimulatorPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Simulator</h1>
      <p className="text-muted">
        The simulator is being built. The engine arrives in Phase 1 and this screen in Phase 2.
      </p>
      <div className="grid gap-2 font-mono text-sm sm:grid-cols-3" aria-label="Colour key preview">
        <span className="rounded-sm border border-border bg-surface px-3 py-2 text-read">
          ↓ read 042
        </span>
        <span className="rounded-sm border border-border bg-surface px-3 py-2 text-write">
          ↑ write 107
        </span>
        <span className="rounded-sm border border-border bg-surface px-3 py-2 text-branch">
          ↪ branch 12
        </span>
      </div>
    </div>
  );
}
