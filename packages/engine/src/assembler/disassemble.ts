/**
 * Turns mailbox values back into assembly, so learners can see that code is just numbers.
 * Assembling the result gives back exactly the same memory.
 */
import { canonicalSpelling, getDialect } from "../dialects/dialects";
import type { DialectId, Mnemonic } from "../dialects/types";
import { decode, encode, takesAddress } from "../core/semantics";

export type Disassembled =
  | {
      readonly kind: "instruction";
      readonly mnemonic: Mnemonic;
      readonly text: string;
      readonly address?: number;
    }
  | { readonly kind: "data"; readonly value: number; readonly text: string };

/** One mailbox value as assembly: an instruction when it is one, otherwise DAT. */
export function disassembleWord(value: number, dialectId: DialectId = "classic"): Disassembled {
  const dialect = getDialect(dialectId);
  const d = decode(value, dialect);
  // Only use a mnemonic when it assembles back to the same value (001 decodes as HLT, but HLT is 000).
  if (d && encode(d.mnemonic, d.address) === value) {
    const spelling = canonicalSpelling(dialect, d.mnemonic) ?? d.mnemonic;
    if (takesAddress(d.mnemonic)) {
      return {
        kind: "instruction",
        mnemonic: d.mnemonic,
        address: d.address,
        text: `${spelling} ${String(d.address).padStart(2, "0")}`,
      };
    }
    return { kind: "instruction", mnemonic: d.mnemonic, text: spelling };
  }
  return { kind: "data", value, text: `DAT ${value}` };
}

export interface DisassembleOptions {
  readonly dialect?: DialectId;
  /** Mailboxes to include. Defaults to everything up to the last non-zero mailbox. */
  readonly length?: number;
  /** Add a comment with each mailbox's address. Default true. */
  readonly addresses?: boolean;
}

export function disassemble(memory: readonly number[], options: DisassembleOptions = {}): string {
  let length = options.length;
  if (length === undefined) {
    length = memory.length;
    while (length > 0 && memory[length - 1] === 0) length--;
  }
  const withAddresses = options.addresses ?? true;
  const lines: string[] = [];
  for (let address = 0; address < length; address++) {
    const { text } = disassembleWord(memory[address] ?? 0, options.dialect);
    lines.push(
      withAddresses
        ? `        ${text.padEnd(10)}// ${String(address).padStart(2, "0")}`
        : `        ${text}`,
    );
  }
  return lines.join("\n");
}
