/**
 * Turns mailbox values back into assembly, so learners can see that code is just numbers.
 * Assembling the result gives back exactly the same memory.
 */
import { canonicalSpelling, getDialect } from "../dialects/dialects";
import type { DialectId, ExtMnemonic, Mnemonic } from "../dialects/types";
import { decode, encode, takesAddress } from "../core/semantics";
import { decodeExt } from "../machines/extended/semantics";

export type Disassembled =
  | {
      readonly kind: "instruction";
      readonly mnemonic: Mnemonic | ExtMnemonic;
      readonly text: string;
      readonly address?: number;
      /** 2 when the next mailbox is this instruction's address or port. */
      readonly words?: 2;
    }
  | { readonly kind: "data"; readonly value: number; readonly text: string };

export interface WordOptions {
  /** Read 4xx as the extended machine's instructions. */
  readonly machine?: "classic" | "extended";
  /** The next mailbox, for a two-mailbox instruction's address or port. */
  readonly next?: number;
}

/** One mailbox value as assembly: an instruction when it is one, otherwise DAT. */
export function disassembleWord(
  value: number,
  dialectId: DialectId = "classic",
  options: WordOptions = {},
): Disassembled {
  const dialect = getDialect(dialectId);
  const ext = options.machine === "extended" ? decodeExt(value) : null;
  const next = options.next;
  // A second mailbox that is not an address cannot be written as one, so it stays DAT.
  const badNext = next !== undefined && !(Number.isInteger(next) && next >= 0 && next <= 99);
  if (ext && !(ext.words === 2 && badNext)) {
    if (ext.words === 1) {
      return { kind: "instruction", mnemonic: ext.mnemonic as ExtMnemonic, text: ext.mnemonic };
    }
    const n = options.next === undefined ? "?" : String(options.next).padStart(2, "0");
    const operand = ext.mode === "indirect" ? `@${n}` : ext.mode === "indexed" ? `${n},X` : n;
    return {
      kind: "instruction",
      mnemonic: ext.mnemonic,
      words: 2,
      ...(options.next === undefined ? {} : { address: options.next }),
      text: `${ext.mnemonic} ${operand}`,
    };
  }
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
  readonly machine?: "classic" | "extended";
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
    // The last mailbox has no next one, so a two-mailbox instruction there is just data.
    const word = disassembleWord(
      memory[address] as number,
      options.dialect,
      address + 1 < memory.length
        ? {
            ...(options.machine ? { machine: options.machine } : {}),
            next: memory[address + 1] as number,
          }
        : {},
    );
    const { text } = word;
    lines.push(
      withAddresses
        ? `        ${text.padEnd(10)}// ${String(address).padStart(2, "0")}`
        : `        ${text}`,
    );
    // The second mailbox is part of this instruction.
    if (word.kind === "instruction" && word.words === 2) address++;
  }
  return lines.join("\n");
}
