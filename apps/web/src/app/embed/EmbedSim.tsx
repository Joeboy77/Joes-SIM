"use client";

import { parseEmbedOptions, type EmbedSettings } from "@joes-sim/embed";
import { useEffect, useMemo } from "react";
import { useSearch } from "@/lib/useSearch";
import { RunBar } from "@/sim/controls/RunBar";
import { Editor } from "@/sim/editor/Editor";
import { ExplainPanel } from "@/sim/panels/ExplainPanel";
import { IOPanel } from "@/sim/panels/IOPanel";
import { MachinePanel } from "@/sim/panels/MachinePanel";
import { SimProvider, useSim, useSimState } from "@/sim/SimProvider";
import { STARTER_PROGRAM } from "@/sim/store";
import { usePlaybackLoop } from "@/sim/usePlayback";
import { decodeShare, sharePath } from "@/sim/workspace/share";

interface Ready {
  readonly settings: EmbedSettings;
  readonly source: string;
  readonly dialect: NonNullable<EmbedSettings["dialect"]>;
  readonly machine: "classic" | "extended";
  readonly inputs: string;
  readonly view: NonNullable<EmbedSettings["view"]>;
  readonly name: string;
}

/** Reads the options from the address (they differ for every embed, so the page is not prebuilt). */
function read(search: string): Ready {
  const settings = parseEmbedOptions(new URLSearchParams(search));
  const shared = settings.program === null ? decodeShare(settings.p) : null;
  return {
    settings,
    source: settings.program ?? shared?.source ?? STARTER_PROGRAM,
    dialect: settings.dialect ?? shared?.dialect ?? "classic",
    machine: settings.machine ?? shared?.machine ?? "classic",
    inputs:
      settings.inputs ?? shared?.inputs ?? (settings.program === null && !shared ? "3, 4" : ""),
    view: settings.view ?? shared?.view ?? "datapath",
    name: settings.name || shared?.name || "",
  };
}

export function EmbedSim() {
  const search = useSearch();
  const ready = useMemo(() => (search === null ? null : read(search)), [search]);
  if (!ready) return <p className="p-3 text-muted">Loading the simulator…</p>;
  return (
    <SimProvider
      initial={{
        source: ready.source,
        dialect: ready.dialect,
        machine: ready.machine,
        inputText: ready.inputs,
      }}
    >
      <Embedded ready={ready} />
    </SimProvider>
  );
}

function Embedded({ ready }: { ready: Ready }) {
  usePlaybackLoop();
  const store = useSim();
  const { settings } = ready;
  const has = (p: (typeof settings.panels)[number]) => settings.panels.includes(p);
  const source = useSimState((s) => s.source);
  const dialect = useSimState((s) => s.dialect);
  const machine = useSimState((s) => s.machine);
  const inputs = useSimState((s) => s.inputText);
  const view = useSimState((s) => s.view);

  useEffect(() => store.getState().setView(ready.view), [store, ready.view]);

  const open = sharePath({ name: ready.name, source, dialect, machine, inputs, view });

  return (
    <div className="space-y-3 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-bold">
          Joe&apos;s SIM
          {ready.name ? <span className="font-normal text-muted">: {ready.name}</span> : null}
        </h1>
        <a
          href={open}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-11 items-center rounded-md border border-accent px-3 text-sm font-bold text-accent"
        >
          Open in Joe&apos;s SIM<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      {has("editor") && (
        <div className="h-56 overflow-hidden rounded-md border border-border">
          <Editor readOnly={settings.readonly} />
        </div>
      )}
      <div className="rounded-md border border-border">
        <RunBar />
      </div>
      {has("machine") && <MachinePanel memory={has("memory")} />}
      {!has("machine") && has("memory") && <MachinePanel memory />}
      {has("explain") && <ExplainPanel />}
      {has("io") && <IOPanel />}
    </div>
  );
}
