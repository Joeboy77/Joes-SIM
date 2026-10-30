/**
 * English messages. To translate, copy this file and keep every key. In a message,
 * `{name}` is a value and `[[PC]]` is the name of a machine part, taken from `terms`.
 */
import type { Component } from "@joes-sim/engine";
import type { Level } from "./types";

const beginner = {
  // One micro-step.
  "fetch-address":
    "The Little Man reads the [[PC]]: the next instruction is in mailbox {address}. He notes {address} in the [[MAR]].",
  "fetch-read":
    "He opens mailbox {address} in the [[MEMORY]] and copies the number inside, {value}, into the [[MDR]].",
  "fetch-load-ir": "He puts {value} on the [[IR]], so he knows what to do next.",
  "fetch-increment": "He adds one to the [[PC]], ready for next time. It now says {value}.",
  decode: "The [[CONTROL]] reads {instruction}: {meaning}.",
  "decode-invalid":
    "The [[CONTROL]] reads {instruction}, which is not an instruction the Little Man knows, so he stops with an error.",
  "operand-address": "He copies the address part, {address}, from the [[IR]] into the [[MAR]].",
  "operand-read": "He opens mailbox {address} and copies {value} into the [[MDR]].",
  "alu-add": "The [[ALU]] adds {a} and {b}, and the [[ACC]] becomes {result}.",
  "alu-sub": "The [[ALU]] takes {b} away from {a}, and the [[ACC]] becomes {result}.",
  "load-acc": "He copies {value} from the [[MDR]] into the [[ACC]].",
  "store-mdr": "He copies the [[ACC]], {value}, into the [[MDR]].",
  "store-write": "He writes {value} into mailbox {address}, replacing {previous}.",
  "branch-BRA":
    "He sets the [[PC]] to {target}, so the next instruction comes from mailbox {target}.",
  "branch-BRZ-taken": "The [[ACC]] is zero, so he sets the [[PC]] to {target}.",
  "branch-BRZ-not-taken": "The [[ACC]] is {acc}, not zero, so he carries on to mailbox {next}.",
  "branch-BRZ-flag":
    "The [[ACC]] shows {acc}, but the negative flag is set, so it does not count as zero. He carries on to mailbox {next}.",
  "branch-BRP-taken": "The [[ACC]] is {acc}, which is positive, so he sets the [[PC]] to {target}.",
  "branch-BRP-zero":
    "The [[ACC]] is 0. Zero counts as positive, so he sets the [[PC]] to {target}.",
  "branch-BRP-not-taken":
    "The negative flag is set, so the [[ACC]] counts as negative. He carries on to mailbox {next}.",
  input: "He takes {value} from the [[INPUT]] and puts it in the [[ACC]].",
  "input-needed": "The [[INPUT]] is empty, so the Little Man waits for you to give him a number.",
  output: "He copies the [[ACC]], {value}, into the [[OUTPUT]].",
  "output-char": "He looks up character code {value} and puts '{char}' in the [[OUTPUT]].",
  halt: "The Little Man stops work. The program has finished.",

  // What each instruction means, used by "decode".
  "meaning-ADD": "add the number in mailbox {address}",
  "meaning-SUB": "subtract the number in mailbox {address}",
  "meaning-STA": "store the accumulator in mailbox {address}",
  "meaning-LDA": "load the number from mailbox {address}",
  "meaning-BRA": "always go to mailbox {address} next",
  "meaning-BRZ": "go to mailbox {address} if the accumulator is zero",
  "meaning-BRP": "go to mailbox {address} if the accumulator is zero or positive",
  "meaning-INP": "take a number from the in-tray",
  "meaning-OUT": "put the accumulator's number in the out-tray",
  "meaning-OTC": "put the accumulator's number in the out-tray as a character",
  "meaning-HLT": "stop",

  // A whole instruction.
  "summary-LDA":
    "The instruction is {instruction}, so the Little Man loads the value from mailbox {address} into the [[ACC]]. The [[ACC]] is now {acc}.",
  "summary-ADD":
    "The instruction is {instruction}, so the Little Man adds the value in mailbox {address} ({b}) to the [[ACC]]. The [[ACC]] is now {acc}.",
  "summary-SUB":
    "The instruction is {instruction}, so the Little Man subtracts the value in mailbox {address} ({b}) from the [[ACC]]. The [[ACC]] is now {acc}.",
  "summary-STA":
    "The instruction is {instruction}, so the Little Man stores the [[ACC]] ({acc}) in mailbox {address}.",
  "summary-BRA":
    "The instruction is {instruction}, so the Little Man goes to mailbox {target} next.",
  "summary-BRZ-taken":
    "The instruction is {instruction}. The [[ACC]] is zero, so the Little Man goes to mailbox {target} next.",
  "summary-BRZ-not-taken":
    "The instruction is {instruction}. The [[ACC]] is {acc}, not zero, so the Little Man carries on to mailbox {next}.",
  "summary-BRZ-flag":
    "The instruction is {instruction}. The negative flag is set, so the [[ACC]] does not count as zero and the Little Man carries on to mailbox {next}.",
  "summary-BRP-taken":
    "The instruction is {instruction}. The [[ACC]] is {acc}, which is positive, so the Little Man goes to mailbox {target} next.",
  "summary-BRP-zero":
    "The instruction is {instruction}. The [[ACC]] is 0, and zero counts as positive, so the Little Man goes to mailbox {target} next.",
  "summary-BRP-not-taken":
    "The instruction is {instruction}. The [[ACC]] counts as negative, so the Little Man carries on to mailbox {next}.",
  "summary-INP":
    "The instruction is {instruction}, so the Little Man takes {value} from the [[INPUT]]. The [[ACC]] is now {acc}.",
  "summary-INP-waiting":
    "The instruction is {instruction}, so the Little Man needs a number, but the [[INPUT]] is empty. He waits for you.",
  "summary-OUT":
    "The instruction is {instruction}, so the Little Man puts {acc} in the [[OUTPUT]].",
  "summary-OTC":
    "The instruction is {instruction}, so the Little Man puts the character '{char}' (code {acc}) in the [[OUTPUT]].",
  "summary-HLT":
    "The instruction is {instruction}, so the Little Man stops. The program has finished.",
  "summary-invalid":
    "Mailbox {address} holds {instruction}, which is not an instruction, so the machine stops with an error.",

  // Added to the end of a sentence.
  "suffix-wrapped":
    "The true answer, {raw}, is outside what the accumulator can hold, so it wraps round to {result}.",
  "suffix-flag-set": "The answer went below zero, so the negative flag is set.",
  "suffix-flag-cleared": "The negative flag is cleared.",
} as const;

export type MessageKey = keyof typeof beginner;

const technical: Record<MessageKey, string> = {
  "fetch-address": "Fetch: copy the [[PC]] ({address}) into the [[MAR]].",
  "fetch-read": "Fetch: read [[MEMORY]] at address {address} into the [[MDR]] ({value}).",
  "fetch-load-ir": "Fetch: copy the [[MDR]] into the [[IR]] ({value}).",
  "fetch-increment": "Fetch: increment the [[PC]] to {value}.",
  decode: "Decode: the [[CONTROL]] decodes {instruction} as {meaning}.",
  "decode-invalid": "Decode: {instruction} is not a valid opcode. The machine stops with an error.",
  "operand-address": "Execute: copy the address field of the [[IR]] ({address}) into the [[MAR]].",
  "operand-read": "Execute: read [[MEMORY]] at address {address} into the [[MDR]] ({value}).",
  "alu-add": "Execute: the [[ALU]] computes {a} + {b}; [[ACC]] ← {result}.",
  "alu-sub": "Execute: the [[ALU]] computes {a} − {b}; [[ACC]] ← {result}.",
  "load-acc": "Execute: copy the [[MDR]] into the [[ACC]] ({value}).",
  "store-mdr": "Execute: copy the [[ACC]] into the [[MDR]] ({value}).",
  "store-write":
    "Execute: write the [[MDR]] ({value}) to [[MEMORY]] at address {address} (was {previous}).",
  "branch-BRA": "Execute: unconditional branch; [[PC]] ← {target}.",
  "branch-BRZ-taken": "Execute: [[ACC]] = 0, branch taken; [[PC]] ← {target}.",
  "branch-BRZ-not-taken": "Execute: [[ACC]] = {acc} ≠ 0, branch not taken; [[PC]] stays {next}.",
  "branch-BRZ-flag": "Execute: negative flag set, branch not taken; [[PC]] stays {next}.",
  "branch-BRP-taken": "Execute: [[ACC]] ≥ 0, branch taken; [[PC]] ← {target}.",
  "branch-BRP-zero": "Execute: [[ACC]] = 0 counts as ≥ 0, branch taken; [[PC]] ← {target}.",
  "branch-BRP-not-taken": "Execute: negative flag set, branch not taken; [[PC]] stays {next}.",
  input: "Execute: [[ACC]] ← [[INPUT]] ({value}).",
  "input-needed": "Execute: the [[INPUT]] queue is empty; waiting for input.",
  output: "Execute: [[OUTPUT]] ← [[ACC]] ({value}).",
  "output-char": "Execute: output the [[ACC]] ({value}) as the character '{char}'.",
  halt: "Execute: HLT. The machine halts.",

  "meaning-ADD": "ADD {address}",
  "meaning-SUB": "SUB {address}",
  "meaning-STA": "STA {address}",
  "meaning-LDA": "LDA {address}",
  "meaning-BRA": "BRA {address}",
  "meaning-BRZ": "BRZ {address}",
  "meaning-BRP": "BRP {address}",
  "meaning-INP": "INP",
  "meaning-OUT": "OUT",
  "meaning-OTC": "OTC",
  "meaning-HLT": "HLT",

  "summary-LDA": "LDA {address}: [[ACC]] ← memory[{address}] = {acc}.",
  "summary-ADD": "ADD {address}: [[ACC]] ← {a} + {b} = {acc}.",
  "summary-SUB": "SUB {address}: [[ACC]] ← {a} − {b} = {acc}.",
  "summary-STA": "STA {address}: memory[{address}] ← [[ACC]] ({acc}).",
  "summary-BRA": "BRA {target}: [[PC]] ← {target}.",
  "summary-BRZ-taken": "BRZ {target}: [[ACC]] = 0, taken; [[PC]] ← {target}.",
  "summary-BRZ-not-taken": "BRZ {target}: [[ACC]] = {acc} ≠ 0, not taken; [[PC]] = {next}.",
  "summary-BRZ-flag": "BRZ {target}: negative flag set, not taken; [[PC]] = {next}.",
  "summary-BRP-taken": "BRP {target}: [[ACC]] = {acc} ≥ 0, taken; [[PC]] ← {target}.",
  "summary-BRP-zero": "BRP {target}: [[ACC]] = 0 counts as ≥ 0, taken; [[PC]] ← {target}.",
  "summary-BRP-not-taken": "BRP {target}: negative flag set, not taken; [[PC]] = {next}.",
  "summary-INP": "INP: [[ACC]] ← [[INPUT]] = {acc}.",
  "summary-INP-waiting": "INP: the [[INPUT]] queue is empty; waiting for input.",
  "summary-OUT": "OUT: [[OUTPUT]] ← [[ACC]] = {acc}.",
  "summary-OTC": "OTC: output '{char}' (code {acc}).",
  "summary-HLT": "HLT: the machine halts.",
  "summary-invalid":
    "Address {address} holds {instruction}, not a valid instruction: machine error.",

  "suffix-wrapped": "The result {raw} is out of range and wraps to {result}.",
  "suffix-flag-set": "Negative flag set.",
  "suffix-flag-cleared": "Negative flag cleared.",
};

export interface Catalogue {
  readonly terms: Readonly<Record<Level, Readonly<Record<Component, string>>>>;
  readonly messages: Readonly<Record<Level, Readonly<Record<MessageKey, string>>>>;
}

export const en: Catalogue = {
  terms: {
    beginner: {
      PC: "program counter",
      MAR: "address register",
      MDR: "data register",
      IR: "instruction register",
      ACC: "accumulator",
      MEMORY: "mailboxes",
      ALU: "calculator",
      CONTROL: "control unit",
      INPUT: "in-tray",
      OUTPUT: "out-tray",
    },
    technical: {
      PC: "PC",
      MAR: "MAR",
      MDR: "MDR",
      IR: "IR",
      ACC: "ACC",
      MEMORY: "memory",
      ALU: "ALU",
      CONTROL: "control unit",
      INPUT: "input",
      OUTPUT: "output",
    },
  },
  messages: { beginner, technical },
};
