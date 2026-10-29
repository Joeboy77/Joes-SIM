import type { DialectId, Mnemonic } from "../dialects/types";

export type Severity = "error" | "warning";

export type DiagnosticCode =
  | "unknown-instruction"
  | "instruction-not-in-dialect"
  | "label-without-instruction"
  | "invalid-label"
  | "duplicate-label"
  | "undefined-label"
  | "missing-address"
  | "address-out-of-range"
  | "value-out-of-range"
  | "invalid-operand"
  | "operand-ignored"
  | "extra-text"
  | "program-too-long";

export interface Fix {
  /** What the fix does, for a button or hint. */
  readonly label: string;
  /** Replace columns [from, to) of the line with `text`. Columns are 1-based. */
  readonly edit?: { readonly from: number; readonly to: number; readonly text: string };
}

export interface Diagnostic {
  readonly severity: Severity;
  readonly code: DiagnosticCode;
  /** 1-based line number. */
  readonly line: number;
  /** 1-based start column. */
  readonly column: number;
  /** 1-based end column, exclusive. */
  readonly endColumn: number;
  /** Short message, for example "Label 'lop' is not defined. Did you mean 'loop'?" */
  readonly message: string;
  /** Plain-language explanation of why this matters. */
  readonly explanation: string;
  readonly fix?: Fix;
}

export interface Statement {
  readonly line: number;
  readonly address: number;
  readonly label?: string;
  readonly mnemonic: Mnemonic | "DAT";
  /** The operand as written, if any. */
  readonly operandText?: string;
  /** Set when the operand is a label. */
  readonly operandLabel?: string;
  /** The value placed in the mailbox. */
  readonly value: number;
}

export type MailboxKind = "code" | "data" | "empty";

export interface Program {
  readonly dialect: DialectId;
  /** All 100 mailboxes, ready to load into the machine. */
  readonly memory: readonly number[];
  readonly statements: readonly Statement[];
  readonly labels: Readonly<Record<string, { readonly address: number; readonly line: number }>>;
  /** Source line (1-based) for each address, or null for mailboxes the source does not fill. */
  readonly addressToLine: readonly (number | null)[];
  /** Address for each source line (index = line - 1), or null for lines with no statement. */
  readonly lineToAddress: readonly (number | null)[];
  /** How the source declares each mailbox: an instruction, a DAT, or nothing. */
  readonly kinds: readonly MailboxKind[];
  /** Mailboxes the program fills (instructions plus DATs). */
  readonly size: number;
}

export interface AssembleResult {
  /** True when there are no errors. Warnings do not stop assembly. */
  readonly ok: boolean;
  /** The assembled program, or null when there are errors. */
  readonly program: Program | null;
  readonly diagnostics: readonly Diagnostic[];
}
