"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { RunBar } from "./controls/RunBar";
import { Shortcuts } from "./controls/Shortcuts";
import { Editor } from "./editor/Editor";
import { ExplainPanel } from "./panels/ExplainPanel";
import { IOPanel } from "./panels/IOPanel";
import { MachinePanel } from "./panels/MachinePanel";
import { ProblemsPanel } from "./panels/ProblemsPanel";
import { StatusLine } from "./panels/StatusLine";
import { TracePanel } from "./panels/TracePanel";
import { WatchPanel } from "./panels/WatchPanel";
import { SimProvider, useSimState } from "./SimProvider";
import { PredictPanel } from "./predict/PredictPanel";
import { useT } from "@/i18n/useLocale";
import { usePlaybackLoop } from "./usePlayback";
import { FilesMenu } from "./workspace/FilesMenu";
import { ShareButton } from "./workspace/ShareDialog";
import { WorkspaceProvider } from "./workspace/Workspace";

// On phones every part is a tab. On larger screens the inputs and output stay in view and the
// other side panels share tabs.
const TABS = [
  { id: "code", label: "tabs.code" },
  { id: "machine", label: "tabs.machine" },
  { id: "explain", label: "tabs.explain" },
  { id: "trace", label: "tabs.trace" },
  { id: "watch", label: "tabs.watch" },
  { id: "io", label: "tabs.io" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const SIDE_TABS = [
  { id: "explain", label: "tabs.explain" },
  { id: "trace", label: "tabs.trace" },
  { id: "watch", label: "tabs.watch" },
] as const;
type SideTab = (typeof SIDE_TABS)[number]["id"];
const SIDE = new Set<Tab>(["explain", "trace", "watch", "io"]);

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title} className={`min-h-0 overflow-auto ${className}`}>
      {children}
    </section>
  );
}

function Layout() {
  usePlaybackLoop();
  const presentation = useSimState((s) => s.presentation);
  const [tab, setTab] = useState<Tab>("code");
  const translate = useT();
  const t = translate;
  const [side, setSide] = useState<SideTab>("explain");
  /** Shown on phones when its tab is chosen, and on larger screens when its side tab is. */
  const sideClass = (id: SideTab) =>
    `${tab === id ? "block" : "hidden"} ${side === id ? "lg:block" : "lg:hidden"}`;
  const touchStart = useRef<number | null>(null);

  // Presentation mode enlarges everything, including rem-based sizes.
  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = presentation ? "137.5%" : "";
    return () => {
      root.style.fontSize = "";
    };
  }, [presentation]);

  // On phones, swipe left and right between tabs.
  const onTouchEnd = (x: number) => {
    if (touchStart.current === null) return;
    const dx = x - touchStart.current;
    touchStart.current = null;
    if (Math.abs(dx) < 60) return;
    const i = TABS.findIndex((t) => t.id === tab);
    const next = TABS[Math.min(TABS.length - 1, Math.max(0, i + (dx < 0 ? 1 : -1)))];
    if (next) setTab(next.id);
  };

  return (
    <div className="flex h-dvh flex-col">
      {/* On phones the file sits on its own row, so its name has room. */}
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border bg-surface px-3 py-2">
        <Link href="/" className="font-bold whitespace-nowrap">
          Joe&apos;s SIM
        </Link>
        <div className="order-last flex w-full min-w-0 sm:order-none sm:w-auto sm:grow">
          <FilesMenu />
        </div>
        <h1 className="sr-only">Simulator</h1>
        <div className="flex items-center gap-2">
          <ShareButton />
          <Shortcuts />
          <ThemeSwitcher />
        </div>
      </header>

      {/* On phones the run bar sits at the bottom, within thumb reach. */}
      <div className="order-last lg:order-none">
        <RunBar />
      </div>
      <StatusLine />

      <nav
        aria-label={t("tabs.panels")}
        className="flex border-b border-border bg-surface lg:hidden"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-11 flex-1 px-0.5 text-xs leading-tight font-bold sm:text-sm ${tab === t.id ? "border-b-4 border-accent text-text" : "text-muted"}`}
          >
            {translate(t.label)}
          </button>
        ))}
      </nav>

      <main
        id="main"
        className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(18rem,1fr)_minmax(26rem,1.7fr)_minmax(16rem,1fr)]"
        onTouchStart={(e) => (touchStart.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => onTouchEnd(e.changedTouches[0]?.clientX ?? 0)}
      >
        <Panel
          title="Code"
          className={`rounded-md border border-border ${tab === "code" ? "" : "hidden"} lg:block`}
        >
          <Editor />
        </Panel>
        <Panel title="Machine" className={`${tab === "machine" ? "" : "hidden"} lg:block`}>
          <MachinePanel />
        </Panel>
        <Panel
          title="Inputs, output and explanations"
          className={`space-y-4 ${SIDE.has(tab) ? "" : "hidden"} lg:block`}
        >
          <div className={`${tab === "io" ? "block" : "hidden"} lg:block`}>
            <IOPanel />
          </div>
          <div
            role="group"
            aria-label={t("tabs.side")}
            className="hidden gap-1 border-b border-border lg:flex"
          >
            {SIDE_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={side === t.id}
                onClick={() => setSide(t.id)}
                className={`min-h-11 flex-1 text-sm font-bold ${side === t.id ? "border-b-4 border-accent text-text" : "text-muted"}`}
              >
                {translate(t.label)}
              </button>
            ))}
          </div>
          <div className={`space-y-6 ${sideClass("explain")}`}>
            <PredictPanel />
            <ExplainPanel />
            <ProblemsPanel />
          </div>
          <div className={sideClass("trace")}>
            <TracePanel />
          </div>
          <div className={sideClass("watch")}>
            <WatchPanel />
          </div>
        </Panel>
      </main>
    </div>
  );
}

export function Simulator() {
  return (
    <SimProvider>
      <WorkspaceProvider>
        <Layout />
      </WorkspaceProvider>
    </SimProvider>
  );
}
