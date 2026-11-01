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

  // The extended machine, one micro-step.
  error: "The machine stops with an error: {message}",
  "operand-fetch-address":
    "This instruction keeps its address in the next mailbox, {address}. He notes {address} in the [[MAR]].",
  "operand-fetch-read":
    "He copies {value} from mailbox {address} into the [[MDR]], and moves the [[PC]] on to {next} so he does not run it as an instruction.",
  "operand-address-ext": "He copies the address, {address}, into the [[MAR]].",
  "indirect-address":
    "Mailbox {address} does not hold the value itself: it holds where to find it. He notes {address} in the [[MAR]].",
  "indirect-read":
    "He opens mailbox {address} and finds {value}: that is the address of the value he needs.",
  "index-add":
    "He adds the [[X]] ({x}) to {operand}, which points to mailbox {address}. He notes {address} in the [[MAR]].",
  "store-mdr-x": "He copies the [[X]], {value}, into the [[MDR]].",
  "load-x": "He copies {value} from the [[MDR]] into the [[X]].",
  "index-up": "He adds one to the [[X]]. It now says {result}.",
  "index-down": "He takes one from the [[X]]. It now says {result}.",
  "stack-push":
    "He moves the [[SP]] down to {address} and puts the [[ACC]], {value}, on top of the stack there.",
  "stack-push-call":
    "He moves the [[SP]] down to {address} and writes the return address, {value}, on top of the stack, so he can find his way back.",
  "stack-save-PC":
    "He moves the [[SP]] down to {address} and saves the [[PC]], {value}, on the stack: that is where the main program will carry on.",
  "stack-save-ACC":
    "He moves the [[SP]] down to {address} and saves the [[ACC]], {value}, on the stack.",
  "stack-save-flag":
    "He moves the [[SP]] down to {address} and saves the negative flag ({value}) on the stack.",
  "stack-pop":
    "He takes {value} off the top of the stack, from mailbox {address}, and moves the [[SP]] up to {sp}.",
  "stack-pop-return":
    "He takes the return address, {value}, off the stack and moves the [[SP]] up to {sp}.",
  "stack-restore-flag":
    "He takes the saved negative flag ({value}) off the stack and puts it back. The [[SP]] is now {sp}.",
  "stack-restore-ACC":
    "He takes the saved [[ACC]], {value}, off the stack and puts it back. The [[SP]] is now {sp}.",
  "stack-restore-PC":
    "He takes the saved [[PC]], {value}, off the stack, so the main program carries on from mailbox {value}. The [[SP]] is now {sp}.",
  call: "He sets the [[PC]] to {target}, the start of the subroutine.",
  return: "He sets the [[PC]] to {target}, back to the instruction after the CALL.",
  "interrupts-on": "He turns interrupts on: a device may now stop the main program.",
  "interrupts-off":
    "He turns interrupts off: no device can stop the program until they are on again.",
  "interrupts-on-again":
    "He turns interrupts back on and goes back to the main program at mailbox {target}.",
  "set-vector":
    "He sets the [[IV]] to {address}: when a device needs attention, he will run the handler there.",
  "wait-idle": "Nothing needs attention yet, so the Little Man waits.",
  "wait-done": "A device needs attention, so he stops waiting.",
  "device-read": "He reads port {port}, the {device}, and puts {value} in the [[ACC]].",
  "device-write": "He sends the [[ACC]], {value}, to port {port}, the {device}.",
  "interrupt-enter":
    "The {source} needs attention! He stops the main program before mailbox {from} and turns interrupts off, so nothing else can stop him.",
  "interrupt-jump": "He sets the [[PC]] to {handler}, where the interrupt handler starts.",

  // Names used inside sentences.
  "name-console": "console",
  "name-keyboard": "keyboard",
  "name-display": "pixel display",
  "name-timer": "timer",
  "name-seven-segment": "seven-segment display",
  "name-beeper": "beeper",
  "name-interrupts": "interrupt controller",
  "name-source-timer": "timer",
  "name-source-keyboard": "keyboard",

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
  "meaning-PUSH": "put the accumulator on top of the stack",
  "meaning-POP": "take the top of the stack into the accumulator",
  "meaning-CALL": "call the subroutine whose address is in the next mailbox",
  "meaning-RET": "return from a subroutine",
  "meaning-LDX": "load the index register from the mailbox named in the next mailbox",
  "meaning-STX": "store the index register in the mailbox named in the next mailbox",
  "meaning-INX": "add one to the index register",
  "meaning-DEX": "take one from the index register",
  "meaning-EI": "turn interrupts on",
  "meaning-DI": "turn interrupts off",
  "meaning-RTI": "return from an interrupt",
  "meaning-VEC": "set where the interrupt handler starts",
  "meaning-WAIT": "wait for a device to need attention",
  "meaning-GET": "read a device port",
  "meaning-PUT": "send the accumulator to a device port",
  "meaning-LDA-indirect": "load a value using an address kept in a mailbox (indirect)",
  "meaning-STA-indirect": "store the accumulator using an address kept in a mailbox (indirect)",
  "meaning-ADD-indirect": "add a value found through an address kept in a mailbox (indirect)",
  "meaning-SUB-indirect": "subtract a value found through an address kept in a mailbox (indirect)",
  "meaning-LDA-indexed": "load a value from a table, at the position in the index register",
  "meaning-STA-indexed": "store the accumulator in a table, at the position in the index register",
  "meaning-ADD-indexed": "add a value from a table, at the position in the index register",
  "meaning-SUB-indexed": "subtract a value from a table, at the position in the index register",

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
  "summary-error":
    "The instruction is {instruction}, but the machine stops with an error: {message}",
  "summary-PUSH":
    "The instruction is {instruction}, so the Little Man puts the [[ACC]] ({acc}) on top of the stack, in mailbox {address}.",
  "summary-POP":
    "The instruction is {instruction}, so the Little Man takes {acc} off the top of the stack into the [[ACC]].",
  "summary-CALL":
    "The instruction is {instruction}, so the Little Man saves the return address {back} on the stack and goes to the subroutine at mailbox {target}.",
  "summary-RET":
    "The instruction is {instruction}, so the Little Man takes the return address off the stack and goes back to mailbox {target}.",
  "summary-LDX":
    "The instruction is {instruction}, so the Little Man loads the [[X]] from mailbox {address}. It is now {x}.",
  "summary-STX":
    "The instruction is {instruction}, so the Little Man stores the [[X]] ({x}) in mailbox {address}.",
  "summary-INX":
    "The instruction is {instruction}, so the Little Man adds one to the [[X]]. It is now {x}.",
  "summary-DEX":
    "The instruction is {instruction}, so the Little Man takes one from the [[X]]. It is now {x}.",
  "summary-EI": "The instruction is {instruction}, so the Little Man turns interrupts on.",
  "summary-DI": "The instruction is {instruction}, so the Little Man turns interrupts off.",
  "summary-RTI":
    "The instruction is {instruction}, so the Little Man takes the saved flag, [[ACC]] and [[PC]] off the stack and goes back to the main program at mailbox {target}.",
  "summary-VEC":
    "The instruction is {instruction}, so interrupts will now run the handler at mailbox {address}.",
  "summary-WAIT-idle":
    "The instruction is {instruction}. Nothing needs attention yet, so the Little Man waits and tries again.",
  "summary-WAIT-done":
    "The instruction is {instruction}. A device needs attention, so the Little Man stops waiting.",
  "summary-WAIT-waiting":
    "The instruction is {instruction}, so the Little Man waits for a key press. Type on the keyboard to wake him.",
  "summary-GET":
    "The instruction is {instruction}, so the Little Man reads port {port}, the {device}. The [[ACC]] is now {acc}.",
  "summary-PUT":
    "The instruction is {instruction}, so the Little Man sends {acc} to port {port}, the {device}.",
  "summary-LDA-indirect":
    "The instruction is {instruction}. Mailbox {pointer} points to mailbox {address}, so the Little Man loads the value from there. The [[ACC]] is now {acc}.",
  "summary-STA-indirect":
    "The instruction is {instruction}. Mailbox {pointer} points to mailbox {address}, so the Little Man stores the [[ACC]] ({acc}) there.",
  "summary-ADD-indirect":
    "The instruction is {instruction}. Mailbox {pointer} points to mailbox {address}, so the Little Man adds the value there. The [[ACC]] is now {acc}.",
  "summary-SUB-indirect":
    "The instruction is {instruction}. Mailbox {pointer} points to mailbox {address}, so the Little Man subtracts the value there. The [[ACC]] is now {acc}.",
  "summary-LDA-indexed":
    "The instruction is {instruction}. The table starts at {base} and the [[X]] is {x}, so the Little Man loads from mailbox {address}. The [[ACC]] is now {acc}.",
  "summary-STA-indexed":
    "The instruction is {instruction}. The table starts at {base} and the [[X]] is {x}, so the Little Man stores the [[ACC]] ({acc}) in mailbox {address}.",
  "summary-ADD-indexed":
    "The instruction is {instruction}. The table starts at {base} and the [[X]] is {x}, so the Little Man adds the value in mailbox {address}. The [[ACC]] is now {acc}.",
  "summary-SUB-indexed":
    "The instruction is {instruction}. The table starts at {base} and the [[X]] is {x}, so the Little Man subtracts the value in mailbox {address}. The [[ACC]] is now {acc}.",
  "summary-INT":
    "The {source} needs attention, so the Little Man saves the [[PC]], [[ACC]] and flag on the stack and runs the interrupt handler at mailbox {handler}.",
  "suffix-timer": "The timer ticks: a timer interrupt is waiting.",
  "suffix-key": "A key arrives: '{char}' joins the keyboard buffer.",
  "suffix-key-dropped": "A key arrives, but the keyboard buffer is full, so '{char}' is lost.",
  "suffix-beep": "The beeper plays note {note}.",

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

  error: "Error: {message}",
  "operand-fetch-address": "Operand fetch: copy the [[PC]] ({address}) into the [[MAR]].",
  "operand-fetch-read":
    "Operand fetch: read [[MEMORY]] at {address} into the [[MDR]] ({value}); [[PC]] ← {next}.",
  "operand-address-ext": "Execute: [[MAR]] ← {address}.",
  "indirect-address": "Execute (indirect): [[MAR]] ← {address}, the pointer's address.",
  "indirect-read": "Execute (indirect): read the pointer at {address}: effective address {value}.",
  "index-add": "Execute (indexed): [[MAR]] ← {operand} + [[X]] ({x}) = {address}.",
  "store-mdr-x": "Execute: copy the [[X]] into the [[MDR]] ({value}).",
  "load-x": "Execute: [[X]] ← [[MDR]] ({value}).",
  "index-up": "Execute: [[X]] ← [[X]] + 1 = {result}.",
  "index-down": "Execute: [[X]] ← [[X]] − 1 = {result}.",
  "stack-push": "Execute: [[SP]] ← {address}; memory[{address}] ← [[ACC]] ({value}).",
  "stack-push-call": "Execute: [[SP]] ← {address}; memory[{address}] ← return address ({value}).",
  "stack-save-PC": "Interrupt: [[SP]] ← {address}; push [[PC]] ({value}).",
  "stack-save-ACC": "Interrupt: [[SP]] ← {address}; push [[ACC]] ({value}).",
  "stack-save-flag": "Interrupt: [[SP]] ← {address}; push the negative flag ({value}).",
  "stack-pop": "Execute: [[MDR]] ← memory[{address}] ({value}); [[SP]] ← {sp}.",
  "stack-pop-return": "Execute: pop the return address ({value}); [[SP]] ← {sp}.",
  "stack-restore-flag": "Execute: pop the negative flag ({value}); [[SP]] ← {sp}.",
  "stack-restore-ACC": "Execute: pop [[ACC]] ({value}); [[SP]] ← {sp}.",
  "stack-restore-PC": "Execute: pop [[PC]] ({value}); [[SP]] ← {sp}.",
  call: "Execute: [[PC]] ← {target} (subroutine).",
  return: "Execute: [[PC]] ← {target} (return).",
  "interrupts-on": "Execute: IE ← 1.",
  "interrupts-off": "Execute: IE ← 0.",
  "interrupts-on-again": "Execute: IE ← 1; resume at {target}.",
  "set-vector": "Execute: [[IV]] ← {address}.",
  "wait-idle": "Execute: no interrupt pending; idle.",
  "wait-done": "Execute: interrupt pending; WAIT ends.",
  "device-read": "Execute: [[ACC]] ← port {port} ({device}) = {value}.",
  "device-write": "Execute: port {port} ({device}) ← [[ACC]] ({value}).",
  "interrupt-enter": "Interrupt ({source}): accepted before {from}; IE ← 0.",
  "interrupt-jump": "Interrupt: [[PC]] ← [[IV]] ({handler}).",

  "name-console": "console",
  "name-keyboard": "keyboard",
  "name-display": "display",
  "name-timer": "timer",
  "name-seven-segment": "seven-segment",
  "name-beeper": "beeper",
  "name-interrupts": "interrupt cause",
  "name-source-timer": "timer",
  "name-source-keyboard": "keyboard",

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
  "meaning-PUSH": "PUSH",
  "meaning-POP": "POP",
  "meaning-CALL": "CALL (address in the next word)",
  "meaning-RET": "RET",
  "meaning-LDX": "LDX (address in the next word)",
  "meaning-STX": "STX (address in the next word)",
  "meaning-INX": "INX",
  "meaning-DEX": "DEX",
  "meaning-EI": "EI",
  "meaning-DI": "DI",
  "meaning-RTI": "RTI",
  "meaning-VEC": "VEC (address in the next word)",
  "meaning-WAIT": "WAIT",
  "meaning-GET": "GET (port in the next word)",
  "meaning-PUT": "PUT (port in the next word)",
  "meaning-LDA-indirect": "LDA indirect",
  "meaning-STA-indirect": "STA indirect",
  "meaning-ADD-indirect": "ADD indirect",
  "meaning-SUB-indirect": "SUB indirect",
  "meaning-LDA-indexed": "LDA indexed",
  "meaning-STA-indexed": "STA indexed",
  "meaning-ADD-indexed": "ADD indexed",
  "meaning-SUB-indexed": "SUB indexed",

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
  "summary-error": "{instruction}: error. {message}",
  "summary-PUSH": "PUSH: memory[{address}] ← [[ACC]] ({acc}); [[SP]] = {address}.",
  "summary-POP": "POP: [[ACC]] ← top of stack = {acc}.",
  "summary-CALL": "CALL {target}: push {back}; [[PC]] ← {target}.",
  "summary-RET": "RET: pop; [[PC]] ← {target}.",
  "summary-LDX": "LDX {address}: [[X]] ← {x}.",
  "summary-STX": "STX {address}: memory[{address}] ← [[X]] ({x}).",
  "summary-INX": "INX: [[X]] ← {x}.",
  "summary-DEX": "DEX: [[X]] ← {x}.",
  "summary-EI": "EI: interrupts enabled.",
  "summary-DI": "DI: interrupts disabled.",
  "summary-RTI": "RTI: pop flag, [[ACC]], [[PC]]; IE ← 1; resume at {target}.",
  "summary-VEC": "VEC {address}: [[IV]] ← {address}.",
  "summary-WAIT-idle": "WAIT: no interrupt pending; idle cycle.",
  "summary-WAIT-done": "WAIT: interrupt pending; continue.",
  "summary-WAIT-waiting": "WAIT: no interrupt source can fire; waiting for a key.",
  "summary-GET": "GET {port}: [[ACC]] ← {device} = {acc}.",
  "summary-PUT": "PUT {port}: {device} ← [[ACC]] ({acc}).",
  "summary-LDA-indirect": "LDA @{pointer}: [[ACC]] ← memory[{address}] = {acc}.",
  "summary-STA-indirect": "STA @{pointer}: memory[{address}] ← [[ACC]] ({acc}).",
  "summary-ADD-indirect": "ADD @{pointer}: [[ACC]] ← memory[{address}] added = {acc}.",
  "summary-SUB-indirect": "SUB @{pointer}: [[ACC]] ← memory[{address}] subtracted = {acc}.",
  "summary-LDA-indexed": "LDA {base},X: [[ACC]] ← memory[{base} + {x}] = {acc}.",
  "summary-STA-indexed": "STA {base},X: memory[{base} + {x}] ← [[ACC]] ({acc}).",
  "summary-ADD-indexed": "ADD {base},X: [[ACC]] ← + memory[{base} + {x}] = {acc}.",
  "summary-SUB-indexed": "SUB {base},X: [[ACC]] ← − memory[{base} + {x}] = {acc}.",
  "summary-INT": "Interrupt ({source}): push [[PC]], [[ACC]], flag; IE ← 0; [[PC]] ← {handler}.",
  "suffix-timer": "Timer tick: interrupt pending.",
  "suffix-key": "Key '{char}' buffered.",
  "suffix-key-dropped": "Key '{char}' dropped: buffer full.",
  "suffix-beep": "Beep: note {note}.",

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
      SP: "stack pointer",
      X: "index register",
      IV: "interrupt vector",
      DEVICE: "devices",
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
      SP: "SP",
      X: "X",
      IV: "IV",
      DEVICE: "device",
    },
  },
  messages: { beginner, technical },
};
