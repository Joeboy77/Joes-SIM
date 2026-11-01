/**
 * Everything CodeMirror. Editor.tsx loads this module only after the first paint, so the
 * simulator shows the program as plain text straight away and the editor's code is not part of
 * the first download (decision 0033).
 */
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting } from "@codemirror/language";
import { lintGutter, setDiagnostics, type Diagnostic as CmDiagnostic } from "@codemirror/lint";
import { EditorState, RangeSet, StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  GutterMarker,
  gutter,
  keymap,
  lineNumbers,
  type DecorationSet,
} from "@codemirror/view";
import type { DialectId, Diagnostic, MachineId } from "@joes-sim/engine";
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

export interface LmcEditorOptions {
  readonly source: string;
  readonly readOnly: boolean;
  readonly dialect: () => DialectId;
  readonly machine: () => MachineId;
  /** The learner changed the text. */
  readonly onChange: (text: string) => void;
  /** The learner clicked the breakpoint gutter on this line (1-based). */
  readonly onBreakpoint: (line: number) => void;
}

export interface LmcEditor {
  readonly text: () => string;
  /** Replaces the text, for a program changed outside the editor (opening a file, a draft). */
  readonly setText: (text: string) => void;
  /** Shows diagnostics, breakpoints and the line being executed. */
  readonly show: (
    diagnostics: readonly Diagnostic[],
    breakpointLines: number[],
    current: number | null,
  ) => void;
  readonly destroy: () => void;
}

export function createLmcEditor(parent: HTMLElement, options: LmcEditorOptions): LmcEditor {
  const view = new EditorView({
    state: EditorState.create({
      doc: options.source,
      extensions: [
        lineNumbers(),
        gutter({
          class: "cm-breakpoint-gutter",
          markers: (v) => v.state.field(breakpointField),
          initialSpacer: () => breakpointMarker,
          domEventHandlers: {
            mousedown: (v, line) => {
              options.onBreakpoint(v.state.doc.lineAt(line.from).number);
              return true;
            },
          },
        }),
        breakpointField,
        currentLineField,
        lintGutter(),
        history(),
        lmcLanguage,
        syntaxHighlighting(lmcHighlight),
        autocompletion({ override: [lmcCompletions(options.dialect, options.machine)] }),
        keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
        EditorView.contentAttributes.of({ "aria-label": "Program code", spellcheck: "false" }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) options.onChange(u.state.doc.toString());
        }),
        theme,
        EditorState.readOnly.of(options.readOnly),
      ],
    }),
    parent,
  });
  // The scroll area must be reachable by keyboard for long programs (axe: scrollable-region-focusable).
  view.scrollDOM.tabIndex = 0;
  view.scrollDOM.setAttribute("aria-label", "Program code, scrollable");
  return {
    text: () => view.state.doc.toString(),
    setText: (text) =>
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }),
    show: (diagnostics, breakpointLines, current) => {
      view.dispatch(setDiagnostics(view.state, toCm(view, diagnostics)));
      view.dispatch({
        effects: [setBreakpointLines.of(breakpointLines), setCurrentLine.of(current)],
      });
    },
    destroy: () => view.destroy(),
  };
}
