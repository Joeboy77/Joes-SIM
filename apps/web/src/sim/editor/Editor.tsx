"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { useSim } from "../SimProvider";
import type { LmcEditor } from "./codemirror";

const readyListeners = new Set<() => void>();

/** The program as plain text, in the editor's font and layout, shown until CodeMirror loads. */
function SourcePreview({ store }: { store: ReturnType<typeof useSim> }) {
  const source = useStore(store, (s) => s.source);
  return (
    <pre
      aria-hidden="true"
      className="m-0 h-full overflow-hidden bg-surface py-1 ps-12 font-mono text-[0.95rem] leading-[1.4] text-text"
    >
      {source}
    </pre>
  );
}

export function Editor({ readOnly = false }: { readOnly?: boolean }) {
  const store = useSim();
  const host = useRef<HTMLDivElement>(null);
  const editorRef = useRef<LmcEditor | null>(null);

  // Create the editor once. CodeMirror is loaded just after the first paint, so the plain-text
  // preview shows straight away and the editor's code is not in the page's first download.
  useEffect(() => {
    let editor: LmcEditor | null = null;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      void import("./codemirror").then(({ createLmcEditor }) => {
        if (cancelled || !host.current) return;
        editor = createLmcEditor(host.current, {
          source: store.getState().source,
          readOnly,
          dialect: () => store.getState().dialect,
          machine: () => store.getState().machine,
          onChange: (text) => {
            // Changes made by the sync below come from the store already; only report the learner's.
            if (text !== store.getState().source) store.getState().setSource(text);
          },
          onBreakpoint: (line) => {
            const address = store.getState().assembled.program?.lineToAddress[line - 1];
            if (address !== null && address !== undefined) {
              store.getState().toggleBreakpoint(address);
            }
          },
        });
        editorRef.current = editor;
        readyListeners.forEach((l) => l());
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      editor?.destroy();
      editorRef.current = null;
      readyListeners.forEach((l) => l());
    };
  }, [store, readOnly]);

  // Keep diagnostics, breakpoints and the current line in step with the store.
  useEffect(() => {
    const sync = () => {
      const editor = editorRef.current;
      if (!editor) return;
      const s = store.getState();
      const program = s.assembled.program;
      const breakpointLines = program
        ? s.breakpoints.map((a) => program.addressToLine[a]).filter((l): l is number => l != null)
        : [];
      const started = s.state && s.state.microSteps > 0;
      const current =
        started && program ? (program.addressToLine[s.state?.currentAddress ?? 0] ?? null) : null;
      editor.show(s.assembled.diagnostics, breakpointLines, current);
    };
    sync();
    // Once the editor exists, show the current diagnostics, breakpoints and line in it.
    readyListeners.add(sync);
    const unsubscribe = store.subscribe((s, prev) => {
      // The program can change from outside the editor: opening a file, a draft, a backup.
      const editor = editorRef.current;
      if (editor && s.source !== prev.source && s.source !== editor.text()) {
        editor.setText(s.source);
      }
      if (
        s.assembled !== prev.assembled ||
        s.breakpoints !== prev.breakpoints ||
        s.state !== prev.state
      )
        sync();
    });
    return () => {
      unsubscribe();
      readyListeners.delete(sync);
    };
  }, [store]);

  // Until the editor has loaded, show the program as plain text so it appears straight away.
  const ready = useSyncExternalStore(
    (notify) => {
      readyListeners.add(notify);
      return () => readyListeners.delete(notify);
    },
    () => editorRef.current !== null,
    () => false,
  );
  return (
    <div ref={host} className="relative h-full min-h-48 overflow-hidden" data-testid="editor">
      {!ready && <SourcePreview store={store} />}
    </div>
  );
}
