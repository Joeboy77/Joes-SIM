"use client";

import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting } from "@codemirror/language";
import { lintGutter, setDiagnostics, type Diagnostic as CmDiagnostic } from "@codemirror/lint";
import { EditorState, RangeSet, StateEffect, StateField, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  GutterMarker,
  gutter,
  keymap,
  lineNumbers,
  type DecorationSet,
} from "@codemirror/view";
import type { Diagnostic } from "@joes-sim/engine";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { useSim } from "../SimProvider";
import { lmcCompletions, lmcHighlight, lmcLanguage } from "./lmc-language";

/** Lines with a breakpoint (1-based). */
const setBreakpointLines = StateEffect.define<number[]>();
/** The line being executed (1-based), or null. */
const setCurrentLine = StateEffect.define<number | null>();

class BreakpointMarker extends GutterMarker {
  override toDOM() {
    const el = document.createElement("span");
    el.className = "cm-breakpoint-marker";
    el.textContent = "●";
    el.setAttribute("aria-label", "Breakpoint");
    return el;
  }
}
const breakpointMarker = new BreakpointMarker();

const breakpointField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(set, tr) {
    for (const e of tr.effects) {
      if (e.is(setBreakpointLines)) {
        const doc = tr.state.doc;
        return RangeSet.of(
          e.value
            .filter((l) => l >= 1 && l <= doc.lines)
            .map((l) => breakpointMarker.range(doc.line(l).from)),
          true,
        );
      }
    }
    return set.map(tr.changes);
  },
});

const currentLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setCurrentLine)) {
        if (e.value === null || e.value > tr.state.doc.lines) return Decoration.none;
        const line = tr.state.doc.line(e.value);
        return Decoration.set([
          Decoration.line({ class: "cm-current-instruction" }).range(line.from),
        ]);
      }
    }
    return deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

function toCm(view: EditorView, diagnostics: readonly Diagnostic[]): CmDiagnostic[] {
  const doc = view.state.doc;
  return diagnostics
    .filter((d) => d.line <= doc.lines)
    .map((d) => {
      const line = doc.line(d.line);
      const from = Math.min(line.from + d.column - 1, line.to);
      const to = Math.max(from, Math.min(line.from + d.endColumn - 1, line.to));
      const fix = d.fix?.edit;
      return {
        from,
        to,
        severity: d.severity,
        message: `${d.message} ${d.explanation}`,
        ...(fix && d.fix
          ? {
              actions: [
                {
                  name: d.fix.label,
                  apply(v: EditorView) {
                    v.dispatch({
                      changes: {
                        from: line.from + fix.from - 1,
                        to: line.from + fix.to - 1,
                        insert: fix.text,
                      },
                    });
                  },
                },
              ],
            }
          : {}),
      };
    });
}

const theme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "var(--sim-editor-font-size, 0.95rem)",
    backgroundColor: "var(--sim-color-surface)",
  },
  ".cm-content": {
    fontFamily: "var(--font-mono)",
    caretColor: "var(--sim-color-text)",
    color: "var(--sim-color-text)",
  },
  ".cm-scroller": { fontFamily: "var(--font-mono)" },
  ".cm-gutters": {
    backgroundColor: "var(--sim-color-surface-2)",
    color: "var(--sim-color-text-muted)",
    borderRight: "1px solid var(--sim-color-border)",
  },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-current-instruction": {
    backgroundColor: "color-mix(in srgb, var(--sim-color-accent) 18%, transparent)",
    boxShadow: "inset 4px 0 0 var(--sim-color-accent)",
  },
  ".cm-breakpoint-gutter": { width: "1.4em", cursor: "pointer" },
  ".cm-breakpoint-marker": { color: "var(--sim-color-danger)", paddingLeft: "0.3em" },
  "&.cm-focused": { outline: "3px solid var(--sim-color-focus)", outlineOffset: "-3px" },
  ".cm-tooltip": {
    backgroundColor: "var(--sim-color-surface)",
    color: "var(--sim-color-text)",
    border: "1px solid var(--sim-color-border-strong)",
  },
});

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
  const viewRef = useRef<EditorView | null>(null);

  // Create the editor once.
  useEffect(() => {
    if (!host.current) return;
    const toggleAtLine = (view: EditorView, pos: number) => {
      const line = view.state.doc.lineAt(pos).number;
      const address = store.getState().assembled.program?.lineToAddress[line - 1];
      if (address !== null && address !== undefined) store.getState().toggleBreakpoint(address);
      return true;
    };
    const extensions: Extension[] = [
      lineNumbers(),
      gutter({
        class: "cm-breakpoint-gutter",
        markers: (v) => v.state.field(breakpointField),
        initialSpacer: () => breakpointMarker,
        domEventHandlers: { mousedown: (view, line) => toggleAtLine(view, line.from) },
      }),
      breakpointField,
      currentLineField,
      lintGutter(),
      history(),
      lmcLanguage,
      syntaxHighlighting(lmcHighlight),
      autocompletion({
        override: [
          lmcCompletions(
            () => store.getState().dialect,
            () => store.getState().machine,
          ),
        ],
      }),
      keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
      EditorView.contentAttributes.of({ "aria-label": "Program code", spellcheck: "false" }),
      EditorView.updateListener.of((u) => {
        if (!u.docChanged) return;
        const text = u.state.doc.toString();
        // Changes made by the sync below come from the store already; only report the learner's.
        if (text !== store.getState().source) store.getState().setSource(text);
      }),
      theme,
      EditorState.readOnly.of(readOnly),
    ];
    // Build the editor just after the first paint, so the plain-text preview shows straight away
    // and the page is drawn before the editor's work starts.
    let view: EditorView | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => {
        if (!host.current) return;
        view = new EditorView({
          state: EditorState.create({ doc: store.getState().source, extensions }),
          parent: host.current,
        });
        // The scroll area must be reachable by keyboard for long programs (axe: scrollable-region-focusable).
        view.scrollDOM.tabIndex = 0;
        view.scrollDOM.setAttribute("aria-label", "Program code, scrollable");
        viewRef.current = view;
        readyListeners.forEach((l) => l());
      }, 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      view?.destroy();
      viewRef.current = null;
      readyListeners.forEach((l) => l());
    };
  }, [store, readOnly]);

  // Keep diagnostics, breakpoints and the current line in step with the store.
  useEffect(() => {
    const sync = () => {
      const view = viewRef.current;
      if (!view) return;
      const s = store.getState();
      const program = s.assembled.program;
      const breakpointLines = program
        ? s.breakpoints.map((a) => program.addressToLine[a]).filter((l): l is number => l != null)
        : [];
      const started = s.state && s.state.microSteps > 0;
      const current =
        started && program ? (program.addressToLine[s.state?.currentAddress ?? 0] ?? null) : null;
      view.dispatch(setDiagnostics(view.state, toCm(view, s.assembled.diagnostics)));
      view.dispatch({
        effects: [setBreakpointLines.of(breakpointLines), setCurrentLine.of(current)],
      });
    };
    sync();
    // Once the editor exists, show the current diagnostics, breakpoints and line in it.
    readyListeners.add(sync);
    const unsubscribe = store.subscribe((s, prev) => {
      // The program can change from outside the editor: opening a file, a draft, a backup.
      const view = viewRef.current;
      if (view && s.source !== prev.source && s.source !== view.state.doc.toString()) {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: s.source } });
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
    () => viewRef.current !== null,
    () => false,
  );
  return (
    <div ref={host} className="relative h-full min-h-48 overflow-hidden" data-testid="editor">
      {!ready && <SourcePreview store={store} />}
    </div>
  );
}
