/** LMC syntax for CodeMirror: highlighting and autocomplete for mnemonics and labels. */
import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { HighlightStyle, StreamLanguage, type StringStream } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { DIALECTS, type DialectId } from "@joes-sim/engine";

const ALL_MNEMONICS = new Set(
  Object.values(DIALECTS).flatMap((d) => [
    ...Object.keys(d.spellings),
    ...Object.keys(d.unsupported),
    "DAT",
  ]),
);

interface LineState {
  /** Position in the line: 0 before any word, then 1, 2... */
  words: number;
  sawMnemonic: boolean;
}

export const lmcLanguage = StreamLanguage.define<LineState>({
  name: "lmc",
  startState: () => ({ words: 0, sawMnemonic: false }),
  token(stream: StringStream, state: LineState) {
    if (stream.sol()) {
      state.words = 0;
      state.sawMnemonic = false;
    }
    if (stream.eatSpace()) return null;
    if (stream.match("//") || stream.match(";") || stream.match("#")) {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.match(/^[+-]?\d+/)) {
      state.words++;
      return "number";
    }
    const word = stream.match(/^[^\s;#/]+/);
    if (!word) {
      stream.next();
      return null;
    }
    const text = stream.current();
    state.words++;
    if (ALL_MNEMONICS.has(text.toUpperCase())) {
      state.sawMnemonic = true;
      return "keyword";
    }
    // A word before the mnemonic is a label being defined; after it, a label being used.
    return state.sawMnemonic ? "variableName" : "labelName";
  },
  languageData: { commentTokens: { line: "//" } },
});

export const lmcHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--sim-color-accent)", fontWeight: "700" },
  { tag: tags.number, color: "var(--sim-color-write)" },
  { tag: tags.comment, color: "var(--sim-color-text-muted)", fontStyle: "italic" },
  { tag: tags.labelName, color: "var(--sim-color-branch)", fontWeight: "700" },
  { tag: tags.variableName, color: "var(--sim-color-branch)" },
]);

const DESCRIPTIONS: Record<string, string> = {
  ADD: "Add a mailbox to the accumulator",
  SUB: "Subtract a mailbox from the accumulator",
  STA: "Store the accumulator in a mailbox",
  STO: "Store (same as STA)",
  LDA: "Load a mailbox into the accumulator",
  BRA: "Branch always",
  BRZ: "Branch if the accumulator is zero",
  BRP: "Branch if the accumulator is zero or positive",
  INP: "Read the next input",
  OUT: "Output the accumulator as a number",
  OTC: "Output the accumulator as a character",
  HLT: "Stop",
  COB: "Stop (same as HLT)",
  DAT: "Reserve a mailbox, with an optional starting value",
};

/** Completes mnemonics allowed by the dialect, and labels defined in the program. */
export function lmcCompletions(dialect: () => DialectId) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[A-Za-z_][A-Za-z0-9_]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    const d = DIALECTS[dialect()];
    const mnemonics = [...Object.keys(d.spellings), "DAT"].map((label) => ({
      label,
      type: "keyword",
      info: DESCRIPTIONS[label] ?? "",
    }));
    const text = context.state.doc.toString();
    const labels = new Set<string>();
    for (const line of text.split("\n")) {
      const first = /^\s*([A-Za-z_][A-Za-z0-9_]*):?\s/.exec(line + " ")?.[1];
      if (first && !ALL_MNEMONICS.has(first.toUpperCase())) labels.add(first);
    }
    return {
      from: word.from,
      options: [
        ...mnemonics,
        ...[...labels].map((label) => ({ label, type: "variable", info: "Label" })),
      ],
      validFor: /^[A-Za-z_][A-Za-z0-9_]*$/,
    };
  };
}
